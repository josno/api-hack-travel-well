"use strict";

const appState = {
  "destinationCountry" : "",
  "destinationCity": "",
  "citizenship": "",
  "destinationCountryCode":"",
  "date":"",
  "renderedDate":""
}

$('body').on('click','.submit-button', function () {
    $('.container').hide()
    $('h1').hide()
    $('.instructions-descrip').hide()
    $('.results-page').toggleClass('hidden')
    appState['destinationCountry'] = $('.country').val()
    appState['citizenship'] = $('.nationality').val()
    appState['destinationCity'] = $('.city').val()

    let month = $('.month').val()
    let monthText = $('.month option:selected').text()
    let day = $('.day').val()
    let year = $('.year').val()
    appState['date'] = `${year}-${month}-${day}`
    appState['renderedDate'] = `${monthText} ${day}, ${year}`

    renderUserInfo(appState)
    getCountryCodes(appState['citizenship'], appState['destinationCountry'])

});

/* API Functions */
//Gets the country objects from REST countries to pass through other functions that get visa & currency information
function getCountryCodes(citizenship, destination) {
  let citizenshipUrl =`https://restcountries.eu/rest/v2/name/${citizenship}`

  let destinationUrl =`https://restcountries.eu/rest/v2/name/${destination}`

  console.log(citizenshipUrl)
  console.log(destinationUrl)

  Promise.all([ //returns array with city and currency codes
    fetch(citizenshipUrl)
      .then(response => response.json())
      .then(responseCitizenship => [responseCitizenship[0].alpha2Code, responseCitizenship[0].currencies[0]])
      .catch(err => handleErrors(err)),
    fetch(destinationUrl)
      .then(response => response.json())
      //condition if input name matches object value name exactly return the alpha2 code (put in a function)
      .then(responseDestination => [responseDestination[0].alpha2Code, responseDestination[0].currencies[0]])
      .catch(err => handleErrors(err))
  ])
    .then(codes => {
      console.log(codes)
      getVisaInfo(codes[0][0], codes[1][0], appState)
        .then(sherpaResponse => renderVisaText(sherpaResponse))
      getCurrencyExchange(codes[0][1].code, codes[1][1].code)
        .then(currencyJson => renderCurrencyExchange(currencyJson))
        .catch(err => handleErrors(err))
      getCityCoordinates(appState)
        .then(obj => getWeatherInfo(obj.coord.lat, obj.coord.lon, appState['date'])
          .then(weatherResponse => renderWeatherInfo(weatherResponse)))
    .catch(err => handleErrors(err))
    })
}

function handleErrors(err){
  $('.results-page').hide()
  $('.error-box').show()
  $('.error-box').html(`Something went wrong. Error '${err.message}'`)
}

function getVisaInfo(citizenship, destination) {
    //Let's deferentiate between the two
    let myKey = "AIzaSyCvrk8ZdgVVsToO93v0v5nMheFb5-AaUjk"

    let urlBase = `https://requirements-api.sandbox.joinsherpa.com/v2/entry-requirements?citizenship=${citizenship}&destination=${destination}&language=en&key=${myKey}`

    appState['destinationCountryCode'] = destination

    console.log(urlBase)

    const myHeader = { //Gotta set a header to pass through authentication
        headers: new Headers({
        "accept": "*/*", //required
        mode:"no-cors"})
    }

    return fetch ("https://cors-anywhere.herokuapp.com/" + urlBase, myHeader) //Need a proxy to bypass same origin policy error
      .then(response => response.json())
};


function getCurrencyExchange(codeOne, codeTwo) {
  // Utilize currency code from REST countries API to get latest exchange rates

  let currencyUrl = `https://free.currconv.com/api/v7/convert?q=${codeOne}_${codeTwo}&apiKey=ce2cecd71a30de95b210`

  console.log(currencyUrl)

  return fetch(currencyUrl)
    .then(response => response.json())
}

function getCityCoordinates(appState){
  let coordKey = "be3fdc44a8fcb1f93b5219a841e601cf"
  let countryCode = appState['destinationCountryCode']
  let city = appState['destinationCity']
  let coordinateUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city},${countryCode}&appid=${coordKey}`

  return fetch(coordinateUrl)
    .then(response => response.json())
}

function getWeatherInfo(lat, lon, date){
  let dateTime = new Date(date).getTime();
  let timestamp = Math.floor(dateTime / 1000);

  let weatherKey = "dc87cbf11257ad136a53a6eb41f28e06"

  let weatherUrl = `https://api.darksky.net/forecast/${weatherKey}/${lat},${lon},${timestamp}`

  const myHeader = { //Gotta set a header to pass through authentication
    headers: new Headers({
    mode:"no-cors"})
}

  return fetch("https://cors-anywhere.herokuapp.com/" + weatherUrl, myHeader)
    .then(response => response.json())
}
/*API Functions End Here*/

/* DOM Manipulation Functions */
function renderUserInfo(appState){
  $('.country-passport').html(appState['citizenship'])
  $('.destination-country').html(appState['destinationCountry'])

  $('.destination-city').html(appState['destinationCity'])
  $('.arrival-date').html(appState['renderedDate'])
}

function renderVisaText(sherpaResponse){
    let textInfo = (sherpaResponse.visa[0].textual.text)

    $('.visa-info').append(textInfo.map(item => `<br>${item}</br>`))
}

function renderCurrencyExchange(responseJson){
  let lookAtValues = Object.values(responseJson)[1]

  let homeCurrency = Object.values(lookAtValues)[0].fr

  let travelCurrency = Object.values(lookAtValues)[0].to

  let roundedRate = Number.parseFloat(Object.values(lookAtValues)[0].val).toFixed(2)

  //Add a condition where if the same currency is used in both countries render a message that the same currency is being used

  if (homeCurrency == travelCurrency){
    $('.currency-info').html(`You can use your home currency for this destination`)
  } else {
    $('.currency-info').html(`1 ${homeCurrency} = ${roundedRate} ${travelCurrency}`)
  }
}

function renderWeatherInfo(responseJson){
  let weatherText = responseJson.currently.summary.toLowerCase()
  $('.weather-info').html(`Expect ${weatherText} on the day you arrive.`)
}

/* DOM Manipulation Functions End Here*/

$('#date-test').datePicker({})

/*UI Autocomplete Here*/

// function activatePlacesSearch() {
//   let options = {
//       types: ['(regions)']
//   };
//   let city = document.getElementById('city');
//   let country = document.getElementById('country');

//   let autocomplete1 = new google.maps.places.Autocomplete(city, options);
//   let autocomplete2 = new google.maps.places.Autocomplete(country, options);
// }
function initialize() {

  var acInputs = document.getElementsByClassName("autocomplete");

  for (var i = 0; i < acInputs.length; i++) {

      var autocomplete = new google.maps.places.Autocomplete(acInputs[i]);
      autocomplete.inputId = acInputs[i].id;

      google.maps.event.addListener(autocomplete, 'place_changed', function () {
          document.getElementById("log").innerHTML = 'You used input with id ' + this.inputId;
      });
  }
}


// let countries = ["Afghanistan","Albania","Algeria","Andorra","Angola","Anguilla","Antigua &amp; Barbuda","Argentina","Armenia","Aruba","Australia","Austria","Azerbaijan","Bahamas"
// 	,"Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bermuda","Bhutan","Bolivia","Bosnia &amp; Herzegovina","Botswana","Brazil","British Virgin Islands"
// 	,"Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon","Canada","Cape Verde","Cayman Islands","Chad","Chile","China","Colombia","Congo","Cook Islands","Costa Rica"
// 	,"Cote D Ivoire","Croatia","Cruise Ship","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea"
// 	,"Estonia","Ethiopia","Falkland Islands","Faroe Islands","Fiji","Finland","France","French Polynesia","French West Indies","Gabon","Gambia","Georgia","Germany","Ghana"
// 	,"Gibraltar","Greece","Greenland","Grenada","Guam","Guatemala","Guernsey","Guinea","Guinea Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India"
// 	,"Indonesia","Iran","Iraq","Ireland","Isle of Man","Israel","Italy","Jamaica","Japan","Jersey","Jordan","Kazakhstan","Kenya","Kuwait","Kyrgyz Republic","Laos","Latvia"
// 	,"Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Macau","Macedonia","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Mauritania"
// 	,"Mauritius","Mexico","Moldova","Monaco","Mongolia","Montenegro","Montserrat","Morocco","Mozambique","Namibia","Nepal","Netherlands","Netherlands Antilles","New Caledonia"
// 	,"New Zealand","Nicaragua","Niger","Nigeria","Norway","Oman","Pakistan","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal"
// 	,"Puerto Rico","Qatar","Reunion","Romania","Russia","Rwanda","Saint Pierre &amp; Miquelon","Samoa","San Marino","Satellite","Saudi Arabia","Senegal","Serbia","Seychelles"
// 	,"Sierra Leone","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka","St Kitts &amp; Nevis","St Lucia","St Vincent","St. Lucia","Sudan"
// 	,"Suriname","Swaziland","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor L'Este","Togo","Tonga","Trinidad &amp; Tobago","Tunisia"
// 	,"Turkey","Turkmenistan","Turks &amp; Caicos","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","United States Minor Outlying Islands","Uruguay"
//   ,"Uzbekistan","Venezuela","Vietnam","Virgin Islands (US)","Yemen","Zambia","Zimbabwe"];

//   $('.country-list').autocomplete({
//     source: countries
//   },{});