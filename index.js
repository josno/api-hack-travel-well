'use strict';

const appState = {
  destinationCountry: '',
  destinationCity: '',
  citizenship: '',
  destinationCountryCode: '',
  date: '',
  renderedDate: ''
};

$('body').on('submit', function (event) {
  event.preventDefault();
  $('.container').hide();
  $('h1').hide();
  $('.instructions-descrip').hide();

  appState.destinationCountry = $('.country').val();
  appState.citizenship = $('.nationality').val();
  appState.destinationCity = formatCity($('.city').val());
  appState.date = $('#datepicker').val();

  getDateString(appState);
  renderUserInfo(appState);
  getAllInfo(appState.citizenship, appState.destinationCountry);
});

/* API Functions */

/*Gets the country objects from REST countries to pass through other functions
  that get visa & currency information*/

function getAllInfo(citizenship, destination) {
  let citizenshipUrl = `https://restcountries.eu/rest/v2/name/${citizenship}`;

  let destinationUrl = `https://restcountries.eu/rest/v2/name/${destination}`;

  Promise.all([
    //Returns array with city and currency codes
    fetch(citizenshipUrl)
      .then(response => response.json())
      .then(responseCitizenship => [
        responseCitizenship[0].alpha2Code,
        responseCitizenship[0].currencies[0]
      ])
      .catch(err => handleErrors(err)),
    fetch(destinationUrl)
      .then(response => response.json())
      .then(responseDestination => [
        responseDestination[0].alpha2Code,
        responseDestination[0].currencies[0]
      ])
      .catch(err => handleErrors(err))
  ]).then(codes => {
    getVisaInfo(codes[0][0], codes[1][0], appState).then(sherpaResponse =>
      renderVisaText(sherpaResponse, appState)
    );
    getCurrencyExchange(codes[0][1].code, codes[1][1].code).then(currencyJson =>
      renderCurrencyExchange(currencyJson)
    );
    getCityCoordinates(appState)
      .then(obj =>
        getWeatherInfo(obj.coord.lat, obj.coord.lon, appState.date).then(weatherResponse =>
          renderWeatherInfo(weatherResponse)
        )
      )
      .then(changePage())
      .catch(err => handleErrors(err));
  });
}

function handleErrors(err) {
  $('.results-page').hide();
  $('.error-box').show();
  $('.error-box')
    .html(`Something went wrong. Check your countries or city and try again. <p><div class='button-center'>
  <input type="submit" class="restart-button button-style" value="Try Again"></p></div>`);
}

function getVisaInfo(citizenship, destination) {
  //Let's deferentiate between the two
  let myKey = 'AIzaSyCvrk8ZdgVVsToO93v0v5nMheFb5-AaUjk';

  let urlBase = `https://requirements-api.sandbox.joinsherpa.com/v2/entry-requirements?citizenship=${citizenship}&destination=${destination}&language=en&key=${myKey}`;

  appState.destinationCountryCode = destination;

  const myHeader = {
    //Need to set a header to pass through authentication
    headers: new Headers({
      accept: '*/*', //required
      mode: 'no-cors'
    })
  };

  return fetch('https://cors-anywhere.herokuapp.com/' + urlBase, myHeader) //Need a proxy to bypass same origin policy error
    .then(response => response.json());
}

function getCurrencyExchange(codeOne, codeTwo) {
  // Utilize currency code from REST countries API to get latest exchange rates

  let currencyUrl = `https://free.currconv.com/api/v7/convert?q=${codeOne}_${codeTwo}&apiKey=ce2cecd71a30de95b210`;

  return fetch(currencyUrl).then(response => response.json());
}

function getCityCoordinates(appState) {
  let coordKey = 'be3fdc44a8fcb1f93b5219a841e601cf';
  let countryCode = appState.destinationCountryCode;
  let city = appState.destinationCity;

  let coordinateUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city},${countryCode}&appid=${coordKey}`;

  return fetch(coordinateUrl).then(response => response.json());
}

function getWeatherInfo(lat, lon, date) {
  let dateTime = new Date(date).getTime();
  let timestamp = Math.floor(dateTime / 1000);

  let weatherKey = 'dc87cbf11257ad136a53a6eb41f28e06';

  let weatherUrl = `https://api.darksky.net/forecast/${weatherKey}/${lat},${lon},${timestamp}`;

  const myHeader = {
    headers: new Headers({
      mode: 'no-cors'
    })
  };

  return fetch('https://cors-anywhere.herokuapp.com/' + weatherUrl, myHeader).then(response =>
    response.json()
  );
}

/*API Functions End Here*/

/* DOM Manipulation Functions */
function formatCity(string) {
  if (string.includes(' -')) {
    return string.split(' -')[0];
  } else {
    return string.split(',')[0];
  }
}

function renderUserInfo(appState) {
  $('.country-passport').html(appState.citizenship);
  $('.destination-country').html(appState.destinationCountry);

  $('.destination-city').html(appState.destinationCity);
  $('.arrival-date').html(appState.renderedDate);
}

function renderVisaText(sherpaResponse, appState) {
  let text = sherpaResponse.visa[0].textual.text;
  let maxStay = '';
  let notes = '';

  if (appState.destinationCountry === appState.citizenship) {
    $('.visa-info').append(
      `Looks like you're traveling in the same country. You don't need a visa!`
    );
  } else {
    if (
      sherpaResponse.visa[0].allowedStay === null &&
      sherpaResponse.visa[0].requirement === 'NOT_REQUIRED'
    ) {
      maxStay = "You don't need a visa to enter this country. Stay as long as you like!";
    } else if (sherpaResponse.visa[0].allowedStay === null) {
      maxStay = 'unknown';
    } else {
      maxStay = sherpaResponse.visa[0].allowedStay;
    }

    $('.visa-info').html(
      `<p> Maximum Days Allowed to Visit:</p>
      <p> ${maxStay} </p>
      <p class='center'> More Details </p>`
    );

    $('.visa-info').append(text.map(item => `<br>${item}</br>`));

    if (sherpaResponse.visa[0].requirement === 'ON_ARRIVAL') {
      $('.visa-info').append(`<p>You will get a visa at your destination.</p>`);
    } else if (
      sherpaResponse.visa[0].requirement === 'E_VISA' &&
      sherpaResponse.visa[0].available === true
    ) {
      let link = sherpaResponse.visa[0].availableVisas[0].productRedirectUrl;
      $('.visa-info').append(
        `<p>You can get an e-visa before you arrive <a href=${link}>here.</a></p>`
      );
    } else if (sherpaResponse.visa[0].requirement === 'EMBASSY_VISA') {
      $('.visa-info').append(`<p>Check with your closest embassy.<p>${notes}</p>`);
    } else if (
      sherpaResponse.visa[0].requirement === 'NOT_REQUIRED' &&
      sherpaResponse.visa[0].notes.length == 1
    ) {
      notes = sherpaResponse.visa[0].notes[0];
      $('.visa-info').append(`<p>${notes}</p>`);
    } else {
      $('.visa-info').append(``);
    }
  }
}

function renderCurrencyExchange(responseJson) {
  let lookAtValues = Object.values(responseJson)[1];

  let homeCurrency = Object.values(lookAtValues)[0].fr;

  let travelCurrency = Object.values(lookAtValues)[0].to;

  let roundedRate = Number.parseFloat(Object.values(lookAtValues)[0].val).toFixed(4);
  /*Show as many decimals to convert currency*/

  /*Add a condition where if the same currency is used in both countries render
    a message that the same currency is being used*/

  if (homeCurrency == travelCurrency) {
    $('.currency-info').html(`You can use your home currency for this destination`);
  } else if (homeCurrency >= travelCurrency) {
    $('.currency-info').html(
      `1 ${homeCurrency} = <span class='red-style'>${roundedRate} ${travelCurrency}</span>`
    );
  } else {
    $('.currency-info').html(
      `<span class='red-style'>1 ${homeCurrency}</span> = ${roundedRate} ${travelCurrency}`
    );
  }
}

function renderWeatherInfo(responseJson) {
  let weatherText = responseJson.daily.data[0].summary;
  let tempHighC = responseJson.daily.data[0].temperatureHigh;
  let tempLowC = responseJson.daily.data[0].temperatureLow;

  let tempHighF = Number.parseFloat((tempHighC - 32) / 1.8).toFixed(2);
  let tempLowF = Number.parseFloat((tempLowC - 32) / 1.8).toFixed(2);

  if (weatherText.includes('rain')) {
    $('#weather').attr('src', 'https://raw.githubusercontent.com/josno/api-hack-travel-well/master/Assets/umbrella.png');
  } else if (weatherText.includes('cloudy')) {
    $('#weather').attr('src', 'https://raw.githubusercontent.com/josno/api-hack-travel-well/master/Assets/cloudy.png');
  } else if (weatherText.includes('snow')) {
    $('#weather').attr('src', 'https://raw.githubusercontent.com/josno/api-hack-travel-well/master/Assets/cold.png');
  } else {
    $('#weather').attr('src', 'https://raw.githubusercontent.com/josno/api-hack-travel-well/master/Assets/sun.png');
  }

  $('.weather-info').html(`${weatherText}
  <p> Highs: ${tempHighC}&#8457 / ${tempHighF}&#8451</p>
  <p> Lows: ${tempLowC}&#8457 / ${tempLowF}&#8451</p>`);
}

function changePage() {
  $('.page-2')
    .css('opacity', 0)
    .fadeIn('slow')
    .animate({ opacity: 1 }, { queue: false, duration: 'slow' }, { top: '-=30px' })
    .slideUp('slow');
  $('.results-page').show();
}

function getDateString(obj) {
  let days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  let now = new Date(obj['date']);
  obj['renderedDate'] =
    days[now.getDay()] +
    ', ' +
    months[now.getMonth()] +
    ' ' +
    now.getDate() +
    ', ' +
    now.getFullYear();
}

$(function () {
  $('#datepicker').datepicker({
    dateFormat: 'yy-mm-dd',
    minDate: 0
  });
});

/* DOM Manipulation Functions End Here*/


/*UI Autocomplete Here*/

$('body').on('click', '.restart-button', function (event) {
  $('.container').show();
  $('h1').show();
  $('.instructions-descrip').show();
  $('.results-page').hide();

  appState.destinationCountry = '';
  appState.citizenship = '';
  appState.destinationCity = '';
  appState.date = '';
  appState.renderedDate = '';
  appState.destinationCountryCode = '';

  $('.visa-info').empty();
  $('.input').val('');
  $('.error-box').hide();
});


function initialize() {
  let acInputs = document.getElementsByClassName('autocomplete');

  for (let i = 0; i < acInputs.length; i++) {
    let autocomplete = new google.maps.places.Autocomplete(acInputs[i]);
    autocomplete.inputId = acInputs[i].id;
  }
}

$(function () {
  let countries = [
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Anguilla',
    'Antarctica',
    'Antigua and Barbuda',
    'Argentina',
    'Armenia',
    'Aruba',
    'Australia',
    'Austria',
    'Azerbaijan',
    'Bahamas',
    'Bahrain',
    'Bangladesh',
    'Barbados',
    'Belarus',
    'Belgium',
    'Belize',
    'Benin',
    'Bermuda',
    'Bhutan',
    'Bolivia',
    'Bonaire, (Plurinational State Of)',
    'Bosnia and Herzegovina',
    'Botswana',
    'Brazil',
    'British Virgin Islands',
    'British Indian Territory',
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cabo Verde',
    'Cambodia',
    'Cameroon',
    'Canada',
    'Cayman Islands',
    'Central African Republic',
    'Chad',
    'Chile',
    'China',
    'Christmas Island',
    'Colombia',
    'Congo, Democratic Republic of the',
    'Cook Islands',
    'Costa Rica',
    "Cote D'Ivoire",
    'Croatia',
    'Cuba',
    'Curacao',
    'Cyprus',
    'Czechia',
    'Denmark',
    'Djibouti',
    'Dominica',
    'Dominican Republic',
    'Ecuador',
    'Egypt',
    'El Salvador',
    'Equatorial Guinea',
    'Eritrea',
    'Estonia',
    'Ethiopia',
    'Falkland Islands (Malvinas)',
    'Faroe Islands',
    'Fiji',
    'Finland',
    'France',
    'French Guiana',
    'French Polynesia',
    'French Southern Territories',
    'Gabon',
    'Gambia',
    'Georgia',
    'Germany',
    'Ghana',
    'Gibraltar',
    'Greece',
    'Greenland',
    'Grenada',
    'Guadeloupe',
    'Guam',
    'Guatemala',
    'Guernsey',
    'Guinea',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Heard Island and McDonald Islands',
    'Holy See',
    'Honduras',
    'Hong Kong',
    'Hungary',
    'Iceland',
    'India',
    'Indonesia',
    'Iran (Islamic Republic of)',
    'Iraq',
    'Ireland',
    'Isle of Man',
    'Israel',
    'Italy',
    'Jamaica',
    'Japan',
    'Jersey',
    'Jordan',
    'Kazakhstan',
    'Kenya',
    'Kiribati',
    "Korea (Democratic People's Republic of)",
    'Korea (Republic of)',
    'Kuwait',
    'Kyrgyzstan',
    "Lao People's Democractic Republid",
    'Latvia',
    'Lebanon',
    'Lesotho',
    'Liberia',
    'Libya',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Macau',
    'Madagascar',
    'Malawi',
    'Malaysia',
    'Maldives',
    'Mali',
    'Malta',
    'Marshall Islands',
    'Martinique',
    'Mauritania',
    'Mauritius',
    'Mayotte',
    'Mexico',
    'Micronesia (Federated States of)',
    'MMoldova, Republic of',
    'Monaco',
    'Mongolia',
    'Montenegro',
    'Montserrat',
    'Morocco',
    'Mozambique',
    'Namibia',
    'Nauru',
    'Nepal',
    'Netherlands',
    'New Caledonia',
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'Niue',
    'Norfolk Island',
    'North Macedonia',
    'Norther Mariana Islands',
    'Norway',
    'Oman',
    'Pakistan',
    'Palestine, State of',
    'Panama',
    'Papua New Guinea',
    'Paraguay',
    'Peru',
    'Philippines',
    'Pitcairn',
    'Poland',
    'Portugal',
    'Puerto Rico',
    'Qatar',
    'Reunion',
    'Romania',
    'Russia',
    'Rwanda',
    'Saint Barthélemy',
    'Saint Helena, Ascension and Tristan da Cunha',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Martin (French)',
    'Saint Pierre and Miquelon',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'San Marino',
    'Sao Tome and Principe',
    'Saudi Arabia',
    'Senegal',
    'Serbia',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Sint Maarten (Dutch part)',
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'South Africa',
    'South Georgia and the South Sandwich Islands',
    'South Sudan',
    'Spain',
    'Sri Lanka',
    'Sudan',
    'Suriname',
    'Svalbard and Jan Mayen',
    'Sweden',
    'Switzerland',
    'Syrian Arab Republic',
    'Taiwan, Province of China',
    'Tajikistan',
    'Tanzania, United Republic of',
    'Thailand',
    'Timor-Leste',
    'Togo',
    'Tokelau',
    'Tonga',
    'Trinidad and Tobago',
    'Tunisia',
    'Turkey',
    'Turkmenistan',
    'Turks and Caicos',
    'Uganda',
    'Ukraine',
    'United Arab Emirates',
    'United Kingdom',
    'United States of America',
    'United States Minor Outlying Islands',
    'Uruguay',
    'Uzbekistan',
    'Vanuatu',
    'Venezuela (Bolivarian Republic of)',
    'Viet Nam',
    'Virgin Islands (British)',
    'Virgin Islands (US)',
    'Wallis and Futuna',
    'Western Sahara',
    'Yemen',
    'Zambia',
    'Zimbabwe'
  ];

  $('.country-list').autocomplete({
    source: countries
  });
});
