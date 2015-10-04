var request = require('request'),
	geocoder = require('geocoder'),
	cheerio = require('cheerio'),
	algoliasearch = require('algoliasearch');
var client = algoliasearch("O9ZV92XQO3", "c0e554f730e532129326f4a028dc2a7f");
var index = client.initIndex('address');
var events_index = client.initIndex('events');


function cleanup(){
	console.log('There is a cleanup');
}

function convertToArray(js_object){
	return Object.keys(js_object).map(function (key) { return js_object[key]; });
}

function isNumeric(value) {
    return /^\d+$/.test(value);
}

function findDay(input_day){
	switch(input_day){
		case "Mon": return 1;
		case "Tue": return 2;
		case "Wed": return 3;
		case "Thu": return 4;
		case "Fri": return 5;
		case "Sat": return 6;
		case "Sun": return 7;
	}
}

function findMonth(input_month){
	switch(input_month){
		case "Jan": return 1;
		case "Feb": return 2;
		case "Mar": return 3;
		case "Apr": return 4;
		case "May": return 5;
		case "Jun": return 6;
		case "Jul": return 7;
		case "Aug": return 8;
		case "Sept": return 9;
		case "Oct": return 10;
		case "Nov": return 11;
		case "Dec": return 12;
	}
}

function convertTime(data){
	console.log('The value of the time is ',data);
	if(data.substring(data.length-2) == "pm"){
		return 12 + parseInt(data.substring(0,data.length-2));
	}else{
		return parseInt(data.substring(0,data.length-2));
	}
}

function addToEvents(data){
	events_index.addObject(data, function(err, content) {
	  console.log('objectID=' + content.objectID);
	});
}

var dartmouth_food_data = [];
//Checking initially for the Dartmouth alone - will change this later
function startCrawling(url,dartmouth_food_data){
	url = "https://dartmouth.edu"+url;
	request(url, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
	 	var $ = cheerio.load(body.toString());
	 	var event_rows = $('.row.event');
	  	var event_row_keys = Object.keys(event_rows);
	  	event_row_keys.forEach(function(key){
	  		if(isNumeric(key)){
	  			var event_data = {
	  			};
	  			event_data["event"] = $($(event_rows[key]).find('.title')).text().trim();
	  			var location_time = $($(event_rows[key]).find('.location')).text();
	  			var description = $($(event_rows[key]).find('.summary')).text();
	  			var location_split = location_time.lastIndexOf(',');
	  			var date_joined = $($(event_rows[key]).find('.two.column.date')).text().trim();
	  			var date_ind = date_joined.split(/\t\n|\n|\t/).filter(function(el) {return el.length != 0});
	  			event_data["day"] = findDay(date_ind[0]);
	  			event_data["month"] = findMonth(date_ind[1]);
	  			event_data["description"] = description.replace('\n','');
	  			event_data["date"] = date_ind[2];
	  			event_data["location"] = location_time.substring(0,location_split).trim();
	  			event_data["time"] = location_time.substring(location_split+1).trim();
	  			var time_splits = event_data["time"].split('-');
	  			console.log('THe value of the time split is ',time_splits);
	  			if(time_splits.length == 1){
	  				event_data["start_time"] = 7;
	  				event_data["end_time"] = 22;
	  			}else{
		  			event_data["start_time"] = convertTime(time_splits[0]);
		  			event_data["end_time"] = convertTime(time_splits[1]);
		  		}
	  			console.log('THe vlaue of hte start tine is ',event_data["start_time"]);
	  			var geolocation = event_data["location"];

	  			console.log('The vlaue of the location is '+geolocation);
	  			index.search(geolocation,{"hitsPerPage": 1}, function(err, content) {
	  				if(content.hits.length == 0){
	  					var comma_seperated = geolocation.split(',');
	  					if(comma_seperated.length >= 2){
	  						geolocation = comma_seperated[1];
	  					}else{
	  						geolocation = comma_seperated[0].split(' ')[0];
	  					}
	  					index.search(geolocation,function(err,content){
	  						if(content.hits.length > 0){
		  						geocoder.geocode(content.hits[0]["address"], function(err, res) {
		  							if(res["results"].length > 0){
									    event_data["lat"] = res["results"][0]["geometry"]["location"]["lat"];
									    event_data["long"] = res["results"][0]["geometry"]["location"]["lng"];
									    dartmouth_food_data.push(event_data);
									    addToEvents(event_data);
									    console.log('pushing ',dartmouth_food_data.length);
									}
								});
							}
	  						// console.log(content.hits);
	  					})
	  				}else{
	  					console.log('The value of the content.hits ',content.hits[0]["address"]);
	  					geocoder.geocode(content.hits[0]["address"], function(err, res) {
	  						if(res["results"].length > 0){
							    event_data["lat"] = res["results"][0]["geometry"]["location"]["lat"];
							    event_data["long"] = res["results"][0]["geometry"]["location"]["lng"];
							    dartmouth_food_data.push(event_data);
							    addToEvents(event_data);
							    console.log('pushing ',dartmouth_food_data.length);
							}else{
								console.log('err ',res);
							}
						});
	  					// console.log(content.hits);		
	  				}
				  
				});
	  		} 		
	  	});
	  	var links  = $('.pagination.row').find('a');
	  	var link_keys = Object.keys(links);
	  	link_keys.forEach(function(key){
	  		if(isNumeric(key)){
		  		if($(links[key]).text() === "Next ›"){
		  			console.log('next crawling');
		  			startCrawling($(links[key]).attr('href'),dartmouth_food_data);
		  		}
		  		else{
		  			crawlingFinished(dartmouth_food_data);
		  		}
			}
		});
	  }
	});
}

function crawlingFinished(data){
	console.log('The crawling has completed');
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startCrawling('/events?category_ids=17&audience_ids=3', dartmouth_food_data);
