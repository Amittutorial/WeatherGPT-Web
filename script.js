/* =========================================================
   WEATHER GPT
   Weather Intelligence & Decision Engine
   FINAL FRONTEND JAVASCRIPT
========================================================= */

"use strict";


/* =========================================================
   API CONFIGURATION
========================================================= */

const WEATHER_API =
    "https://api.open-meteo.com/v1/forecast";

const GEO_API =
    "https://geocoding-api.open-meteo.com/v1/search";

const AQI_API =
    "https://air-quality-api.open-meteo.com/v1/air-quality";

const NOMINATIM_SEARCH_API =
    "https://nominatim.openstreetmap.org/search";

const NOMINATIM_REVERSE_API =
    "https://nominatim.openstreetmap.org/reverse";


/* =========================================================
   GLOBAL STATE
========================================================= */

let currentWeather = null;
let currentLocation = null;

let isCelsius = true;

let selectedProfession = "Student";

let weatherMap = null;
let weatherMarker = null;

let savedLocations = [];

let searchTimer = null;


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    initializeTheme();

    initializeMap();

    loadSavedLocations();

    setupSearch();

    setupAIChat();

    setupLocationResults();

    searchCity("Lucknow");

});


/* =========================================================
   DOM HELPERS
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}


function setText(id, value) {

    const element = getElement(id);

    if (!element) return;

    element.textContent =
        value === null ||
        value === undefined ||
        value === ""
            ? "--"
            : value;
}


function safeNumber(value) {

    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


function formatNumber(value, decimals = 0) {

    const number = safeNumber(value);

    if (number === null) return "--";

    return number.toFixed(decimals);
}


/* =========================================================
   SEARCH
========================================================= */

async function searchWeather() {

    const input = getElement("cityInput");

    if (!input) return;

    const query = input.value.trim();

    if (!query) {

        showMessage(
            "cityInput",
            "Please enter a city, village, college or PIN code."
        );

        return;
    }

    await searchCity(query);
}


async function searchCity(query) {

    const cleanQuery =
        String(query || "").trim();

    if (!cleanQuery) return;

    setLoading(true);

    try {

        const location =
            await geocodeLocation(cleanQuery);

        if (!location) {

            throw new Error(
                "Location not found. Try adding district, state or country."
            );
        }

        currentLocation =
            location;

        updateLocationUI(
            location
        );


        const weather =
            await loadWeather(
                location.latitude,
                location.longitude
            );


        currentWeather =
            weather;


        /*
            IMPORTANT:
            Update hero directly from live API data.
        */

        updateHeroWeather(
            weather
        );


        updateAllWeatherUI(
            weather,
            location
        );


        await loadAirQuality(
            location.latitude,
            location.longitude
        );


        saveRecentLocation(
            location
        );

        updateInputValue(
            location
        );


        document.title =
            `${location.name} Weather | Weather GPT`;


    } catch (error) {

        console.error(
            "Weather Search Error:",
            error
        );

        showGlobalError(
            error.message ||
            "Unable to load weather data."
        );

    } finally {

        setLoading(false);
    }
}


/* =========================================================
   UPDATE ALL WEATHER UI
========================================================= */

function updateAllWeatherUI(
    data,
    location
) {

    if (
        !data ||
        !data.current
    ) {
        return;
    }


    updateLocationUI(
        location
    );


    updateCurrentWeather(
        data,
        location
    );


    updateDetails(
        data
    );


    updateHourly(
        data
    );


    updateForecast(
        data
    );


    updateWeatherStory(
        data
    );


    updateWeatherDecision(
        data
    );


    updateWeatherInsights(
        data
    );


    updateOutdoorAdvice(
        data
    );


    updateProfessionalAdvice(
        data
    );


    updateEmergencyAlert(
        data
    );


    updateFarming(
        data
    );


    /*
        Hero is called here too.
        This guarantees that all normal
        weather refreshes update the hero.
    */

    updateHeroWeather(
        data
    );


    if (
        location &&
        Number.isFinite(location.latitude) &&
        Number.isFinite(location.longitude)
    ) {

        updateMap(
            location.latitude,
            location.longitude,
            location.name
        );
    }
}


/* =========================================================
   GEOCODING
========================================================= */

async function geocodeLocation(query) {

    /*
        First:
        Open-Meteo global geocoder.
    */

    try {

        const url =
            `${GEO_API}?` +
            `name=${encodeURIComponent(query)}` +
            `&count=10` +
            `&language=en` +
            `&format=json`;


        const response =
            await fetch(url);


        if (!response.ok) {
            throw new Error(
                "Open-Meteo geocoding failed."
            );
        }


        const data =
            await response.json();


        if (
            data &&
            Array.isArray(data.results) &&
            data.results.length > 0
        ) {

            const best =
                chooseBestLocation(
                    data.results,
                    query
                );


            if (best) {

                return normalizeOpenMeteoLocation(
                    best
                );
            }
        }

    } catch (error) {

        console.warn(
            "Open-Meteo geocoder failed:",
            error
        );
    }


    /*
        Fallback:
        OpenStreetMap / Nominatim.
    */

    try {

        const url =
            `${NOMINATIM_SEARCH_API}` +
            `?q=${encodeURIComponent(query)}` +
            `&format=json` +
            `&addressdetails=1` +
            `&limit=10`;


        const response =
            await fetch(
                url,
                {
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {
            throw new Error(
                "Nominatim geocoding failed."
            );
        }


        const data =
            await response.json();


        if (
            Array.isArray(data) &&
            data.length > 0
        ) {

            const best =
                chooseBestNominatimLocation(
                    data,
                    query
                );


            return normalizeNominatimLocation(
                best
            );
        }

    } catch (error) {

        console.warn(
            "Nominatim fallback failed:",
            error
        );
    }


    return null;
}


/* =========================================================
   LOCATION SELECTION
========================================================= */

function chooseBestLocation(
    results,
    query
) {

    const search =
        String(query)
            .toLowerCase()
            .trim();


    const exact =
        results.find(
            item =>
                String(
                    item.name || ""
                )
                .toLowerCase()
                === search
        );


    if (exact) {
        return exact;
    }


    const populated =
        results.find(
            item =>
                [
                    "city",
                    "town",
                    "village",
                    "municipality",
                    "suburb"
                ].includes(
                    String(
                        item.feature_code || ""
                    ).toLowerCase()
                )
        );


    return populated ||
        results[0] ||
        null;
}


function chooseBestNominatimLocation(
    results,
    query
) {

    const search =
        String(query)
            .toLowerCase()
            .trim();


    const exact =
        results.find(
            item =>
                String(
                    item.display_name || ""
                )
                .toLowerCase()
                .includes(search)
        );


    return exact ||
        results[0] ||
        null;
}


/* =========================================================
   NORMALIZE OPEN-METEO LOCATION
========================================================= */

function normalizeOpenMeteoLocation(
    location
) {

    if (!location) return null;


    return {

        name:
            location.name ||
            "Unknown Location",

        latitude:
            safeNumber(
                location.latitude
            ),

        longitude:
            safeNumber(
                location.longitude
            ),

        country:
            location.country ||
            "",

        countryCode:
            location.country_code ||
            "",

        admin1:
            location.admin1 ||
            "",

        district:
            location.admin2 ||
            "",

        timezone:
            location.timezone ||
            "",

        elevation:
            safeNumber(
                location.elevation
            ),

        type:
            location.feature_code ||
            "",

        displayName:
            [
                location.name,
                location.admin2,
                location.admin1,
                location.country
            ]
            .filter(Boolean)
            .join(", ")
    };
}


/* =========================================================
   NORMALIZE NOMINATIM LOCATION
========================================================= */

function normalizeNominatimLocation(
    location
) {

    if (!location) return null;


    const address =
        location.address || {};


    const name =
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        address.suburb ||
        address.county ||
        location.name ||
        "Unknown Location";


    return {

        name,

        latitude:
            safeNumber(
                location.lat
            ),

        longitude:
            safeNumber(
                location.lon
            ),

        country:
            address.country ||
            "",

        countryCode:
            address.country_code ||
            "",

        admin1:
            address.state ||
            "",

        district:
            address.state_district ||
            address.county ||
            "",

        village:
            address.village ||
            "",

        postcode:
            address.postcode ||
            "",

        timezone:
            "",

        elevation:
            null,

        type:
            location.type ||
            "",

        displayName:
            location.display_name ||
            name
    };
}


/* =========================================================
   WEATHER API
========================================================= */

async function loadWeather(
    lat,
    lon
) {

    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
    ) {

        throw new Error(
            "Invalid location coordinates."
        );
    }


    const currentVariables = [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "rain",
        "weather_code",
        "cloud_cover",
        "pressure_msl",
        "surface_pressure",
        "wind_speed_10m",
        "wind_direction_10m",
        "wind_gusts_10m",
        "visibility"
    ].join(",");


    const hourlyVariables = [
        "temperature_2m",
        "apparent_temperature",
        "precipitation_probability",
        "precipitation",
        "rain",
        "weather_code",
        "wind_speed_10m",
        "relative_humidity_2m",
        "visibility",
        "cloud_cover"
    ].join(",");


    const dailyVariables = [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "apparent_temperature_min",
        "sunrise",
        "sunset",
        "uv_index_max",
        "precipitation_sum",
        "rain_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "wind_gusts_10m_max"
    ].join(",");


    const url =
        `${WEATHER_API}?` +
        `latitude=${encodeURIComponent(lat)}` +
        `&longitude=${encodeURIComponent(lon)}` +
        `&current=${currentVariables}` +
        `&hourly=${hourlyVariables}` +
        `&daily=${dailyVariables}` +
        `&forecast_days=10` +
        `&timezone=auto` +
        `&temperature_unit=celsius` +
        `&wind_speed_unit=kmh` +
        `&precipitation_unit=mm`;


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `Weather API error: ${response.status}`
        );
    }


    const data =
        await response.json();


    if (
        !data ||
        !data.current ||
        !data.hourly ||
        !data.daily
    ) {

        throw new Error(
            "Weather API returned incomplete data."
        );
    }


    console.log(
        "LIVE WEATHER API:",
        data
    );


    return data;
}


/* =========================================================
   HERO WEATHER
========================================================= */

function updateHeroWeather(
    data
) {

    if (
        !data ||
        !data.current
    ) {

        console.warn(
            "Hero weather data unavailable."
        );

        return;
    }


    const current =
        data.current;


    const daily =
        data.daily || {};


    /*
        Temperature
    */

    const temperature =
        safeNumber(
            current.temperature_2m
        );


    const heroTemperature =
        getElement(
            "heroTemperature"
        );


    if (
        heroTemperature &&
        temperature !== null
    ) {

        heroTemperature.textContent =
            `${Math.round(temperature)}°`;
    }


    /*
        Rain probability

        Prefer today's daily maximum.
        If unavailable, use current/next
        hourly precipitation probability.
    */

    let rain =
        safeNumber(
            daily
                .precipitation_probability_max
                ?.[
                    0
                ]
        );


    if (rain === null) {

        rain =
            getNextRainProbability(
                data.hourly
            );
    }


    const heroRain =
        getElement(
            "heroRain"
        );


    if (
        heroRain &&
        rain !== null
    ) {

        heroRain.textContent =
            `${Math.round(rain)}%`;
    }


    /*
        Wind
    */

    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const heroWind =
        getElement(
            "heroWind"
        );


    if (
        heroWind &&
        wind !== null
    ) {

        heroWind.textContent =
            `${Math.round(wind)} km/h`;
    }


    /*
        Optional center hero values
        if these IDs exist in HTML.
    */

    setOptionalHeroText(
        "heroCenterTemperature",
        temperature !== null
            ? `${Math.round(temperature)}°`
            : "--°"
    );


    setOptionalHeroText(
        "heroCenterCondition",
        weatherCodeToText(
            current.weather_code
        )
    );


    setOptionalHeroText(
        "heroCenterLocation",
        currentLocation?.name ||
        ""
    );


    console.log(
        "HERO UPDATED:",
        {
            temperature,
            rain,
            wind
        }
    );
}


function setOptionalHeroText(
    id,
    value
) {

    const element =
        getElement(id);

    if (!element) return;

    element.textContent =
        value;
}


/* =========================================================
   LOCATION UI
========================================================= */

function updateLocationUI(
    location
) {

    if (!location) return;


    const fullName =
        location.displayName ||
        location.name ||
        "Unknown Location";


    setText(
        "cityName",
        location.name
    );


    setText(
        "locationAddress",
        fullName
    );


    setText(
        "exactLocationName",
        location.name
    );


    setText(
        "exactLocationAddress",
        fullName
    );


    setText(
        "latitudeValue",
        formatNumber(
            location.latitude,
            5
        )
    );


    setText(
        "longitudeValue",
        formatNumber(
            location.longitude,
            5
        )
    );
}


/* =========================================================
   CURRENT WEATHER
========================================================= */

function updateCurrentWeather(
    data,
    location
) {

    if (
        !data ||
        !data.current
    ) {
        return;
    }


    const current =
        data.current;


    const temperature =
        safeNumber(
            current.temperature_2m
        );


    const feelsLike =
        safeNumber(
            current.apparent_temperature
        );


    const humidity =
        safeNumber(
            current.relative_humidity_2m
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const rain =
        safeNumber(
            current.precipitation
        );


    const visibility =
        safeNumber(
            current.visibility
        );


    const weatherCode =
        safeNumber(
            current.weather_code
        );


    setText(
        "temperature",
        temperature !== null
            ? formatTemperature(
                temperature
            )
            : "--"
    );


    setText(
        "condition",
        weatherCodeToText(
            weatherCode
        )
    );


    setText(
        "feels",
        feelsLike !== null
            ? formatTemperature(
                feelsLike
            )
            : "--"
    );


    setText(
        "humidity",
        humidity !== null
            ? `${Math.round(humidity)}%`
            : "--"
    );


    setText(
        "wind",
        wind !== null
            ? `${Math.round(wind)} km/h`
            : "--"
    );


    setText(
        "rain",
        rain !== null
            ? `${rain.toFixed(1)} mm`
            : "--"
    );


    setText(
        "visibility",
        visibility !== null
            ? formatVisibility(
                visibility
            )
            : "--"
    );


    updateWeatherIcon(
        weatherCode,
        current.is_day
    );


    if (location) {

        setText(
            "cityName",
            location.name
        );

        setText(
            "locationAddress",
            location.displayName
        );
    }
}


/* =========================================================
   WEATHER ICON
========================================================= */

function updateWeatherIcon(
    code,
    isDay = 1
) {

    const element =
        getElement(
            "weatherIcon"
        );


    if (!element) return;


    const icon =
        getWeatherIcon(
            code,
            isDay
        );


    element.className =
        `fa-solid ${icon}`;
}


/* =========================================================
   WEATHER CODE → TEXT
========================================================= */

function weatherCodeToText(
    code
) {

    const value =
        safeNumber(code);


    if (value === null) {
        return "Weather unavailable";
    }


    const codes = {

        0: "Clear sky",

        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",

        45: "Fog",
        48: "Depositing rime fog",

        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",

        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",

        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",

        66: "Light freezing rain",
        67: "Heavy freezing rain",

        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",

        77: "Snow grains",

        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",

        85: "Slight snow showers",
        86: "Heavy snow showers",

        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Thunderstorm with heavy hail"
    };


    return codes[value] ||
        "Weather unavailable";
}


/* =========================================================
   WEATHER ICON MAPPING
========================================================= */

function getWeatherIcon(
    code,
    isDay = 1
) {

    const value =
        safeNumber(code);


    if (value === null) {
        return "fa-cloud";
    }


    if (value === 0) {

        return isDay
            ? "fa-sun"
            : "fa-moon";
    }


    if (
        value === 1 ||
        value === 2
    ) {

        return isDay
            ? "fa-cloud-sun"
            : "fa-cloud-moon";
    }


    if (value === 3) {
        return "fa-cloud";
    }


    if (
        value === 45 ||
        value === 48
    ) {
        return "fa-smog";
    }


    if (
        value >= 51 &&
        value <= 67
    ) {
        return "fa-cloud-rain";
    }


    if (
        value >= 71 &&
        value <= 77
    ) {
        return "fa-snowflake";
    }


    if (
        value >= 80 &&
        value <= 82
    ) {
        return "fa-cloud-showers-heavy";
    }


    if (
        value >= 85 &&
        value <= 86
    ) {
        return "fa-snowflake";
    }


    if (value >= 95) {
        return "fa-cloud-bolt";
    }


    return "fa-cloud";
}


/* =========================================================
   WEATHER DETAILS
========================================================= */

function updateDetails(
    data
) {

    if (
        !data ||
        !data.current ||
        !data.daily
    ) {
        return;
    }


    const current =
        data.current;


    const daily =
        data.daily;


    setText(
        "sunrise",
        formatTime(
            daily.sunrise?.[0]
        )
    );


    setText(
        "sunset",
        formatTime(
            daily.sunset?.[0]
        )
    );


    setText(
        "visibilityDetail",
        formatVisibility(
            current.visibility
        )
    );


    setText(
        "pressure",
        current.pressure_msl !== undefined
            ? `${Math.round(
                current.pressure_msl
            )} hPa`
            : "--"
    );


    setText(
        "uvIndex",
        daily.uv_index_max?.[0] !== undefined
            ? formatNumber(
                daily.uv_index_max[0],
                1
            )
            : "--"
    );


    setText(
        "cloudCover",
        current.cloud_cover !== undefined
            ? `${Math.round(
                current.cloud_cover
            )}%`
            : "--"
    );
}


/* =========================================================
   HOURLY FORECAST
========================================================= */

function updateHourly(
    data
) {

    const hourly =
        data?.hourly;


    if (
        !hourly ||
        !Array.isArray(hourly.time)
    ) {
        return;
    }


    const startIndex =
        findCurrentHourIndex(
            hourly.time
        );


    for (
        let cardNumber = 1;
        cardNumber <= 5;
        cardNumber++
    ) {

        const index =
            startIndex +
            cardNumber -
            1;


        const card =
            getElement(
                `hour${cardNumber}`
            );


        if (!card) continue;


        if (
            index >= hourly.time.length
        ) {
            continue;
        }


        const time =
            hourly.time[index];


        const temperature =
            hourly.temperature_2m?.[index];


        const rain =
            hourly.precipitation_probability?.[index];


        const code =
            hourly.weather_code?.[index];


        const timeElement =
            card.querySelector(
                ".hour-time"
            );


        const iconElement =
            card.querySelector(
                ".hour-icon"
            );


        const tempElement =
            card.querySelector(
                ".hour-temp"
            );


        const rainElement =
            card.querySelector(
                ".hour-rain"
            );


        if (timeElement) {

            timeElement.textContent =
                index === startIndex
                    ? "NOW"
                    : formatTime(time);
        }


        if (iconElement) {

            iconElement.className =
                `fa-solid ${
                    getWeatherIcon(
                        code,
                        1
                    )
                } hour-icon`;
        }


        if (tempElement) {

            tempElement.textContent =
                temperature !== undefined
                    ? formatTemperature(
                        temperature
                    )
                    : "--";
        }


        if (rainElement) {

            rainElement.textContent =
                rain !== undefined
                    ? `${Math.round(
                        rain
                    )}% rain`
                    : "--";
        }
    }
}


/* =========================================================
   10 DAY FORECAST
========================================================= */

function updateForecast(
    data
) {

    const daily =
        data?.daily;


    if (
        !daily ||
        !Array.isArray(daily.time)
    ) {
        return;
    }


    for (
        let i = 0;
        i < 10;
        i++
    ) {

        const card =
            getElement(
                `day${i + 1}`
            );


        if (!card) continue;


        if (
            i >= daily.time.length
        ) {
            continue;
        }


        const date =
            daily.time[i];


        const code =
            daily.weather_code?.[i];


        const max =
            daily.temperature_2m_max?.[i];


        const min =
            daily.temperature_2m_min?.[i];


        const rain =
            daily.precipitation_probability_max?.[i];


        const nameElement =
            card.querySelector(
                ".day-name"
            );


        const iconElement =
            card.querySelector(
                ".day-icon"
            );


        const tempElement =
            card.querySelector(
                ".day-temp"
            );


        const conditionElement =
            card.querySelector(
                ".day-condition"
            );


        const rainElement =
            card.querySelector(
                ".day-rain"
            );


        if (nameElement) {

            nameElement.textContent =
                formatDayName(
                    date,
                    i
                );
        }


        if (iconElement) {

            iconElement.className =
                `fa-solid ${
                    getWeatherIcon(
                        code,
                        1
                    )
                } day-icon`;
        }


        if (tempElement) {

            const maxText =
                max !== undefined
                    ? formatTemperature(
                        max
                    )
                    : "--";


            const minText =
                min !== undefined
                    ? formatTemperature(
                        min
                    )
                    : "--";


            tempElement.textContent =
                `${maxText} / ${minText}`;
        }


        if (conditionElement) {

            conditionElement.textContent =
                weatherCodeToText(
                    code
                );
        }


        if (rainElement) {

            rainElement.textContent =
                rain !== undefined
                    ? `${Math.round(
                        rain
                    )}% rain`
                    : "--";
        }
    }
}


/* =========================================================
   WEATHER STORY
========================================================= */

function updateWeatherStory(
    data
) {

    const hourly =
        data?.hourly;


    if (!hourly) return;


    const times = [

        {
            id:
                "timelineMorning",

            condition:
                "timelineMorningCondition",

            hour:
                8
        },

        {
            id:
                "timelineAfternoon",

            condition:
                "timelineAfternoonCondition",

            hour:
                14
        },

        {
            id:
                "timelineEvening",

            condition:
                "timelineEveningCondition",

            hour:
                18
        },

        {
            id:
                "timelineNight",

            condition:
                "timelineNightCondition",

            hour:
                22
        }
    ];


    times.forEach(
        item => {

            const index =
                findHourByLocalHour(
                    hourly.time,
                    item.hour
                );


            if (
                index === -1
            ) {
                return;
            }


            const temperature =
                hourly.temperature_2m?.[
                    index
                ];


            const code =
                hourly.weather_code?.[
                    index
                ];


            setText(
                item.id,
                temperature !== undefined
                    ? formatTemperature(
                        temperature
                    )
                    : "--"
            );


            setText(
                item.condition,
                weatherCodeToText(
                    code
                )
            );
        }
    );
}


/* =========================================================
   WEATHER DECISION ENGINE
========================================================= */

function updateWeatherDecision(
    data
) {

    if (
        !data ||
        !data.current
    ) {
        return;
    }


    const current =
        data.current;


    const hourly =
        data.hourly;


    const temperature =
        safeNumber(
            current.temperature_2m
        );


    const rain =
        getNextRainProbability(
            hourly
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const humidity =
        safeNumber(
            current.relative_humidity_2m
        );


    const visibility =
        safeNumber(
            current.visibility
        );


    let score = 100;


    if (
        temperature !== null &&
        (
            temperature < 8 ||
            temperature > 38
        )
    ) {
        score -= 20;
    }


    if (
        rain !== null &&
        rain > 60
    ) {

        score -= 25;

    } else if (
        rain !== null &&
        rain > 35
    ) {

        score -= 12;
    }


    if (
        wind !== null &&
        wind > 35
    ) {

        score -= 20;

    } else if (
        wind !== null &&
        wind > 25
    ) {

        score -= 10;
    }


    if (
        visibility !== null &&
        visibility < 2000
    ) {
        score -= 15;
    }


    if (
        humidity !== null &&
        humidity > 90
    ) {
        score -= 5;
    }


    score =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    setText(
        "weatherScore",
        score
    );


    let status =
        "Excellent";


    if (score < 40) {

        status =
            "Poor";

    } else if (score < 60) {

        status =
            "Caution";

    } else if (score < 80) {

        status =
            "Good";
    }


    setText(
        "scoreStatus",
        status
    );


    setText(
        "scoreDescription",
        getDecisionDescription(
            score
        )
    );


    setText(
        "travelScore",
        calculateActivityScore(
            data,
            "travel"
        ) + "%"
    );


    setText(
        "exerciseScore",
        calculateActivityScore(
            data,
            "exercise"
        ) + "%"
    );


    setText(
        "photoScore",
        calculateActivityScore(
            data,
            "photo"
        ) + "%"
    );


    setText(
        "outdoorScore",
        calculateActivityScore(
            data,
            "outdoor"
        ) + "%"
    );
}


/* =========================================================
   ACTIVITY SCORE
========================================================= */

function calculateActivityScore(
    data,
    activity
) {

    const current =
        data.current;


    const rain =
        getNextRainProbability(
            data.hourly
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const temperature =
        safeNumber(
            current.temperature_2m
        );


    let score = 100;


    if (rain !== null) {

        if (rain >= 70) {

            score -= 45;

        } else if (rain >= 50) {

            score -= 30;

        } else if (rain >= 30) {

            score -= 15;
        }
    }


    if (wind !== null) {

        if (wind >= 40) {

            score -= 30;

        } else if (wind >= 30) {

            score -= 18;

        } else if (wind >= 20) {

            score -= 8;
        }
    }


    if (temperature !== null) {

        if (
            activity === "exercise" &&
            (
                temperature > 36 ||
                temperature < 8
            )
        ) {
            score -= 20;
        }


        if (
            activity === "photo" &&
            temperature > 40
        ) {
            score -= 12;
        }


        if (
            activity === "travel" &&
            (
                temperature > 42 ||
                temperature < 5
            )
        ) {
            score -= 15;
        }
    }


    return Math.max(
        0,
        Math.min(
            100,
            score
        )
    );
}


/* =========================================================
   WEATHER INSIGHTS
========================================================= */

function updateWeatherInsights(
    data
) {

    if (
        !data ||
        !data.current
    ) {
        return;
    }


    const current =
        data.current;


    const temperature =
        safeNumber(
            current.temperature_2m
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    setText(
        "insightTemp",
        temperature !== null
            ? formatTemperature(
                temperature
            )
            : "--"
    );


    setText(
        "insightRain",
        rain !== null
            ? `${Math.round(
                rain
            )}%`
            : "--"
    );


    setText(
        "insightWind",
        wind !== null
            ? `${Math.round(
                wind
            )} km/h`
            : "--"
    );


    const aqi =
        getElement(
            "aqiValue"
        )?.textContent;


    setText(
        "insightAQI",
        aqi &&
        aqi !== "--"
            ? aqi
            : "--"
    );


    const insight =
        createDailyInsight(
            temperature,
            rain,
            wind
        );


    setText(
        "dailyInsight",
        insight
    );
}


/* =========================================================
   DAILY INSIGHT
========================================================= */

function createDailyInsight(
    temperature,
    rain,
    wind
) {

    if (
        rain !== null &&
        rain >= 70
    ) {

        return "Rain risk is high. Outdoor plans may need flexibility.";
    }


    if (
        wind !== null &&
        wind >= 35
    ) {

        return "Strong winds are possible. Outdoor activities need caution.";
    }


    if (
        temperature !== null &&
        temperature >= 38
    ) {

        return "High temperature detected. Prefer cooler hours for outdoor plans.";
    }


    if (
        temperature !== null &&
        temperature <= 10
    ) {

        return "Cool conditions detected. Check the forecast before extended outdoor activity.";
    }


    return "Current conditions look relatively stable. Check the hourly forecast for timing.";
}


/* =========================================================
   OUTDOOR ADVICE
========================================================= */

function updateOutdoorAdvice(
    data
) {

    const best =
        findBestOutdoorWindow(
            data.hourly
        );


    setText(
        "outdoorTime",
        best.time
    );


    setText(
        "outdoorMessage",
        best.message
    );
}


function findBestOutdoorWindow(
    hourly
) {

    if (
        !hourly ||
        !Array.isArray(hourly.time)
    ) {

        return {
            time:
                "--",

            message:
                "Outdoor timing unavailable."
        };
    }


    let bestIndex =
        -1;


    let bestScore =
        -Infinity;


    const start =
        findCurrentHourIndex(
            hourly.time
        );


    for (
        let i = start;
        i < Math.min(
            start + 12,
            hourly.time.length
        );
        i++
    ) {

        const temp =
            safeNumber(
                hourly.temperature_2m?.[i]
            );


        const rain =
            safeNumber(
                hourly.precipitation_probability?.[i]
            );


        const wind =
            safeNumber(
                hourly.wind_speed_10m?.[i]
            );


        if (
            temp === null ||
            rain === null ||
            wind === null
        ) {
            continue;
        }


        let score = 100;


        if (rain > 60) {

            score -= 50;

        } else if (rain > 30) {

            score -= 25;

        } else {

            score += 10;
        }


        if (wind > 35) {

            score -= 25;

        } else if (wind > 25) {

            score -= 10;
        }


        const tempDifference =
            Math.abs(
                temp - 25
            );


        score -=
            tempDifference * 1.5;


        if (
            score > bestScore
        ) {

            bestScore =
                score;

            bestIndex =
                i;
        }
    }


    if (
        bestIndex === -1
    ) {

        return {
            time:
                "--",

            message:
                "Best outdoor window could not be determined."
        };
    }


    return {

        time:
            formatTime(
                hourly.time[
                    bestIndex
                ]
            ),

        message:
            "Best available window in the next several hours based on temperature, rain probability and wind."
    };
}


/* =========================================================
   PROFESSIONAL ADVICE
========================================================= */

function updateProfessionalAdvice(
    data
) {

    if (!data) return;


    const temperature =
        safeNumber(
            data.current.temperature_2m
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    if (
        selectedProfession ===
        "Farmer"
    ) {

        setText(
            "professionalAdviceTitle",
            "Farming Weather Advice"
        );


        setText(
            "professionalAdvice",
            createFarmingAdvice(
                temperature,
                rain
            )
        );


        return;
    }


    if (
        selectedProfession ===
        "Driver"
    ) {

        setText(
            "professionalAdviceTitle",
            "Driver Weather Advice"
        );


        setText(
            "professionalAdvice",
            createDriverAdvice(
                data
            )
        );


        return;
    }


    if (
        selectedProfession ===
        "Photographer"
    ) {

        setText(
            "professionalAdviceTitle",
            "Photography Weather Advice"
        );


        setText(
            "professionalAdvice",
            createPhotographyAdvice(
                data
            )
        );


        return;
    }


    setText(
        "professionalAdviceTitle",
        "Weather-Aware Planning"
    );


    setText(
        "professionalAdvice",
        "Use the hourly forecast, rain probability and wind conditions to choose the safest and most comfortable time for your work."
    );
}


/* =========================================================
   PROFESSION MODE
========================================================= */

function selectProfession(
    profession,
    button = null
) {

    selectedProfession =
        profession ||
        "Student";


    document
        .querySelectorAll(
            ".profession-btn"
        )
        .forEach(
            btn => {

                btn.classList.remove(
                    "active"
                );
            }
        );


    if (button) {

        button.classList.add(
            "active"
        );

    } else {

        document
            .querySelectorAll(
                ".profession-btn"
            )
            .forEach(
                btn => {

                    const text =
                        btn.textContent
                            .trim()
                            .toLowerCase();


                    if (
                        text.includes(
                            String(
                                selectedProfession
                            )
                            .toLowerCase()
                        )
                    ) {

                        btn.classList.add(
                            "active"
                        );
                    }
                }
            );
    }


    if (currentWeather) {

        updateProfessionalAdvice(
            currentWeather
        );
    }
}


function createFarmingAdvice(
    temperature,
    rain
) {

    if (
        rain !== null &&
        rain >= 60
    ) {

        return "Rain probability is elevated. Review irrigation plans and field access before scheduling outdoor work.";
    }


    if (
        temperature !== null &&
        temperature >= 38
    ) {

        return "High temperatures are possible. Prefer cooler working hours and monitor crop water needs.";
    }


    return "Conditions appear relatively moderate. Continue checking the hourly forecast before irrigation or field work.";
}


function createDriverAdvice(
    data
) {

    const visibility =
        safeNumber(
            data.current.visibility
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    if (
        visibility !== null &&
        visibility < 2000
    ) {

        return "Visibility is currently reduced. Allow extra travel time and check conditions before departure.";
    }


    if (
        rain !== null &&
        rain >= 60
    ) {

        return "Rain probability is high. Check the route forecast before starting the journey.";
    }


    return "Current weather indicators do not show a major immediate issue. Continue checking the hourly route forecast.";
}


function createPhotographyAdvice(
    data
) {

    const cloud =
        safeNumber(
            data.current.cloud_cover
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    if (
        rain !== null &&
        rain >= 60
    ) {

        return "Rain probability is high. Consider an indoor location or a flexible shooting schedule.";
    }


    if (
        cloud !== null &&
        cloud >= 20 &&
        cloud <= 70
    ) {

        return "Partial cloud cover may provide useful natural-light variation. Check the hourly forecast before shooting.";
    }


    return "Check cloud cover, rain probability and the hourly forecast to choose the best photography window.";
}


/* =========================================================
   FARMING
========================================================= */

function updateFarming(
    data
) {

    if (!data) return;


    const temperature =
        safeNumber(
            data.current.temperature_2m
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    let crop =
        "Conditions need monitoring";


    let irrigation =
        "Check soil moisture before irrigation";


    let rainAdvice =
        "Monitor upcoming precipitation";


    let temperatureRisk =
        "Normal monitoring";


    if (
        rain !== null &&
        rain >= 60
    ) {

        crop =
            "Rain risk is elevated";

        irrigation =
            "Review irrigation need";

        rainAdvice =
            "Rain may reduce immediate irrigation requirement";
    }


    if (
        temperature !== null &&
        temperature >= 38
    ) {

        temperatureRisk =
            "High heat risk";
    }


    if (
        temperature !== null &&
        temperature <= 8
    ) {

        temperatureRisk =
            "Low-temperature risk";
    }


    setText(
        "cropCondition",
        crop
    );


    setText(
        "irrigationAdvice",
        irrigation
    );


    setText(
        "farmingRainAdvice",
        rainAdvice
    );


    setText(
        "temperatureRisk",
        temperatureRisk
    );
}


/* =========================================================
   EMERGENCY / WEATHER ALERT
========================================================= */

function updateEmergencyAlert(
    data
) {

    if (!data) return;


    const current =
        data.current;


    const temperature =
        safeNumber(
            current.temperature_2m
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    let title =
        "No major weather warning";


    let message =
        "No strong immediate weather signal was detected from the current forecast data.";


    let icon =
        "fa-circle-check";


    if (
        wind !== null &&
        wind >= 50
    ) {

        title =
            "Strong wind conditions";

        message =
            "Wind speed is elevated. Check the hourly forecast before outdoor activity.";

        icon =
            "fa-wind";

    } else if (
        rain !== null &&
        rain >= 80
    ) {

        title =
            "High rain probability";

        message =
            "The upcoming forecast shows a high probability of precipitation.";

        icon =
            "fa-cloud-showers-heavy";

    } else if (
        temperature !== null &&
        temperature >= 42
    ) {

        title =
            "Very high temperature";

        message =
            "Temperature is unusually high. Consider cooler hours for outdoor plans.";

        icon =
            "fa-temperature-high";
    }


    setText(
        "emergencyTitle",
        title
    );


    setText(
        "emergencyMessage",
        message
    );


    const iconElement =
        getElement(
            "emergencyIcon"
        );


    if (iconElement) {

        iconElement.className =
            `fa-solid ${icon}`;
    }


    setText(
        "alertTitle",
        title
    );


    setText(
        "alertMessage",
        message
    );


    const alertIcon =
        getElement(
            "alertIcon"
        );


    if (alertIcon) {

        alertIcon.className =
            `fa-solid ${icon} alert-icon`;
    }
}


/* =========================================================
   AQI API
========================================================= */

async function loadAirQuality(
    lat,
    lon
) {

    try {

        const currentVariables =
            [
                "us_aqi",
                "us_aqi_pm2_5",
                "us_aqi_pm10",
                "pm2_5",
                "pm10",
                "carbon_monoxide",
                "nitrogen_dioxide",
                "ozone",
                "sulphur_dioxide"
            ]
            .join(",");


        const url =
            `${AQI_API}?` +
            `latitude=${lat}` +
            `&longitude=${lon}` +
            `&current=${currentVariables}` +
            `&timezone=auto`;


        const response =
            await fetch(url);


        if (!response.ok) {

            throw new Error(
                "AQI API request failed."
            );
        }


        const data =
            await response.json();


        if (
            !data ||
            !data.current
        ) {

            throw new Error(
                "AQI data unavailable."
            );
        }


        const current =
            data.current;


        const aqi =
            safeNumber(
                current.us_aqi
            );


        const pm25 =
            safeNumber(
                current.pm2_5
            );


        const pm10 =
            safeNumber(
                current.pm10
            );


        const co =
            safeNumber(
                current.carbon_monoxide
            );


        const no2 =
            safeNumber(
                current.nitrogen_dioxide
            );


        setText(
            "aqiValue",
            aqi !== null
                ? Math.round(aqi)
                : "--"
        );


        setText(
            "aqiStatus",
            getAQIStatus(
                aqi
            )
        );


        setText(
            "pm25",
            pm25 !== null
                ? `${pm25.toFixed(1)} µg/m³`
                : "--"
        );


        setText(
            "pm10",
            pm10 !== null
                ? `${pm10.toFixed(1)} µg/m³`
                : "--"
        );


        setText(
            "co",
            co !== null
                ? `${co.toFixed(0)} µg/m³`
                : "--"
        );


        setText(
            "no2",
            no2 !== null
                ? `${no2.toFixed(1)} µg/m³`
                : "--"
        );


        updateWeatherInsights(
            currentWeather
        );


        console.log(
            "LIVE AQI API:",
            current
        );


    } catch (error) {

        console.error(
            "AQI Error:",
            error
        );


        setText(
            "aqiValue",
            "--"
        );


        setText(
            "aqiStatus",
            "Unavailable"
        );


        setText(
            "pm25",
            "--"
        );


        setText(
            "pm10",
            "--"
        );


        setText(
            "co",
            "--"
        );


        setText(
            "no2",
            "--"
        );
    }
}


/* =========================================================
   AQI STATUS
========================================================= */

function getAQIStatus(
    aqi
) {

    const value =
        safeNumber(aqi);


    if (value === null) {
        return "Unavailable";
    }


    if (value <= 50) {
        return "Good";
    }


    if (value <= 100) {
        return "Moderate";
    }


    if (value <= 150) {
        return "Unhealthy for Sensitive Groups";
    }


    if (value <= 200) {
        return "Unhealthy";
    }


    if (value <= 300) {
        return "Very Unhealthy";
    }


    return "Hazardous";
}


/* =========================================================
   MAP
========================================================= */

function initializeMap() {

    const mapElement =
        getElement(
            "weatherLiveMap"
        );


    if (!mapElement) return;


    if (
        typeof L === "undefined"
    ) {

        console.error(
            "Leaflet is not loaded."
        );

        return;
    }


    weatherMap =
        L.map(
            "weatherLiveMap",
            {
                zoomControl:
                    false
            }
        )
        .setView(
            [
                26.8467,
                80.9462
            ],
            7
        );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:
                19,

            attribution:
                "&copy; OpenStreetMap contributors"
        }
    )
    .addTo(
        weatherMap
    );
}


/* =========================================================
   UPDATE MAP
========================================================= */

function updateMap(
    lat,
    lon,
    name
) {

    if (!weatherMap) return;


    if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lon)
    ) {
        return;
    }


    weatherMap.flyTo(
        [
            lat,
            lon
        ],
        12,
        {
            duration:
                1.2
        }
    );


    if (weatherMarker) {

        weatherMap.removeLayer(
            weatherMarker
        );
    }


    const blinkingIcon =
        L.divIcon({

            className:
                "weather-location-marker",

            html:
                `
                <div style="
                    width:18px;
                    height:18px;
                    border-radius:50%;
                    background:#55c7ff;
                    border:3px solid white;
                    box-shadow:
                        0 0 0 7px rgba(85,199,255,.20),
                        0 0 25px rgba(85,199,255,.75);
                    animation:
                        weatherMarkerPulse 1.5s infinite;
                "></div>
                `,

            iconSize:
                [
                    18,
                    18
                ],

            iconAnchor:
                [
                    9,
                    9
                ]
        });


    weatherMarker =
        L.marker(
            [
                lat,
                lon
            ],
            {
                icon:
                    blinkingIcon
            }
        )
        .addTo(
            weatherMap
        )
        .bindPopup(
            `<strong>${escapeHTML(
                name ||
                "Selected Location"
            )}</strong>`
        )
        .openPopup();


    setText(
        "mapStatus",
        `Live location: ${
            name ||
            "Selected Location"
        }`
    );
}


/* =========================================================
   MAP CONTROLS
========================================================= */

function zoomIn() {

    if (weatherMap) {
        weatherMap.zoomIn();
    }
}


function zoomOut() {

    if (weatherMap) {
        weatherMap.zoomOut();
    }
}


function resetZoom() {

    if (!weatherMap) return;


    if (
        currentLocation &&
        Number.isFinite(
            currentLocation.latitude
        ) &&
        Number.isFinite(
            currentLocation.longitude
        )
    ) {

        weatherMap.setView(
            [
                currentLocation.latitude,
                currentLocation.longitude
            ],
            12
        );

        return;
    }


    weatherMap.setView(
        [
            26.8467,
            80.9462
        ],
        7
    );
}


/* =========================================================
   BROWSER LOCATION
========================================================= */

function getLocation() {

    if (
        !navigator.geolocation
    ) {

        showGlobalError(
            "Geolocation is not supported by this browser."
        );

        return;
    }


    setLoading(
        true
    );


    navigator.geolocation.getCurrentPosition(

        async position => {

            try {

                const lat =
                    position.coords.latitude;


                const lon =
                    position.coords.longitude;


                const weather =
                    await loadWeather(
                        lat,
                        lon
                    );


                currentWeather =
                    weather;


                /*
                    Reverse geocode.
                */

                let location =
                    await reverseGeocode(
                        lat,
                        lon
                    );


                if (!location) {

                    location = {

                        name:
                            "Your Location",

                        displayName:
                            "Your current location",

                        latitude:
                            lat,

                        longitude:
                            lon
                    };
                }


                currentLocation =
                    location;


                /*
                    IMPORTANT:
                    Hero gets live location weather.
                */

                updateHeroWeather(
                    weather
                );


                updateAllWeatherUI(
                    weather,
                    location
                );


                await loadAirQuality(
                    lat,
                    lon
                );


                const input =
                    getElement(
                        "cityInput"
                    );


                if (input) {

                    input.value =
                        location.displayName ||
                        "Your Location";
                }


            } catch (error) {

                console.error(
                    "Location Weather Error:",
                    error
                );


                showGlobalError(
                    "Unable to load weather for your location."
                );


            } finally {

                setLoading(
                    false
                );
            }

        },

        error => {

            console.error(
                "Geolocation Error:",
                error
            );


            let message =
                "Location access was not available.";


            if (
                error.code ===
                error.PERMISSION_DENIED
            ) {

                message =
                    "Location permission was denied. Search your city instead.";
            }


            showGlobalError(
                message
            );


            setLoading(
                false
            );
        },

        {

            enableHighAccuracy:
                true,

            timeout:
                15000,

            maximumAge:
                300000
        }
    );
}


/* =========================================================
   REVERSE GEOCODING
========================================================= */

async function reverseGeocode(
    lat,
    lon
) {

    try {

        const url =
            `${NOMINATIM_REVERSE_API}` +
            `?lat=${encodeURIComponent(lat)}` +
            `&lon=${encodeURIComponent(lon)}` +
            `&format=json` +
            `&addressdetails=1`;


        const response =
            await fetch(url);


        if (!response.ok) {
            return null;
        }


        const data =
            await response.json();


        return normalizeNominatimLocation(
            data
        );


    } catch (error) {

        console.warn(
            "Reverse geocoding failed:",
            error
        );


        return null;
    }
}


/* =========================================================
   TRAVEL MODE
========================================================= */

async function checkTravelWeather() {

    const departure =
        getElement(
            "departureCity"
        )?.value.trim();


    const destination =
        getElement(
            "destinationCity"
        )?.value.trim();


    if (
        !departure ||
        !destination
    ) {

        setText(
            "travelStatus",
            "Enter both locations."
        );

        return;
    }


    setText(
        "travelStatus",
        "Checking both locations..."
    );


    try {

        const [
            from,
            to
        ] =
            await Promise.all([
                geocodeLocation(
                    departure
                ),
                geocodeLocation(
                    destination
                )
            ]);


        if (!from) {

            throw new Error(
                `Departure location "${departure}" not found.`
            );
        }


        if (!to) {

            throw new Error(
                `Destination "${destination}" not found.`
            );
        }


        const [
            fromWeather,
            toWeather
        ] =
            await Promise.all([

                loadWeather(
                    from.latitude,
                    from.longitude
                ),

                loadWeather(
                    to.latitude,
                    to.longitude
                )
            ]);


        const result =
            compareTravelWeather(
                from,
                to,
                fromWeather,
                toWeather
            );


        setText(
            "travelRoute",
            `${from.name} → ${to.name}`
        );


        setText(
            "travelTemp",
            formatTemperature(
                toWeather
                    .current
                    .temperature_2m
            )
        );


        setText(
            "travelRain",
            `${Math.round(
                getNextRainProbability(
                    toWeather.hourly
                ) ?? 0
            )}%`
        );


        setText(
            "travelWind",
            `${Math.round(
                toWeather
                    .current
                    .wind_speed_10m
            )} km/h`
        );


        setText(
            "travelAQI",
            "Check live AQI"
        );


        setText(
            "travelStatus",
            result.status
        );


        setText(
            "travelTip",
            result.tip
        );


        const resultElement =
            getElement(
                "travelResult"
            );


        if (resultElement) {

            resultElement.style.display =
                "block";
        }


    } catch (error) {

        console.error(
            "Travel Error:",
            error
        );


        setText(
            "travelStatus",
            error.message
        );
    }
}


function compareTravelWeather(
    from,
    to,
    fromWeather,
    toWeather
) {

    const rain =
        getNextRainProbability(
            toWeather.hourly
        );


    const wind =
        safeNumber(
            toWeather
                .current
                .wind_speed_10m
        );


    const visibility =
        safeNumber(
            toWeather
                .current
                .visibility
        );


    if (
        rain !== null &&
        rain >= 70
    ) {

        return {

            status:
                "Travel conditions may be challenging.",

            tip:
                `Rain probability is high around ${to.name}. Check the hourly forecast before departure.`
        };
    }


    if (
        wind !== null &&
        wind >= 35
    ) {

        return {

            status:
                "Travel with extra weather awareness.",

            tip:
                `Wind speed is elevated near ${to.name}.`
        };
    }


    if (
        visibility !== null &&
        visibility < 2000
    ) {

        return {

            status:
                "Reduced visibility detected.",

            tip:
                `Visibility is currently reduced near ${to.name}.`
        };
    }


    return {

        status:
            "No major immediate travel signal detected.",

        tip:
            `Conditions at ${to.name} currently look relatively stable according to the forecast data.`
    };
}


/* =========================================================
   WEATHER COMPARISON
========================================================= */

async function compareWeather() {

    const first =
        getElement(
            "compareLocation1"
        )?.value.trim();


    const second =
        getElement(
            "compareLocation2"
        )?.value.trim();


    if (
        !first ||
        !second
    ) {

        setText(
            "comparisonResult",
            "Enter both locations."
        );

        return;
    }


    try {

        const [
            firstLocation,
            secondLocation
        ] =
            await Promise.all([

                geocodeLocation(
                    first
                ),

                geocodeLocation(
                    second
                )
            ]);


        if (
            !firstLocation ||
            !secondLocation
        ) {

            throw new Error(
                "One or both locations could not be found."
            );
        }


        const [
            firstWeather,
            secondWeather
        ] =
            await Promise.all([

                loadWeather(
                    firstLocation.latitude,
                    firstLocation.longitude
                ),

                loadWeather(
                    secondLocation.latitude,
                    secondLocation.longitude
                )
            ]);


        setText(
            "compareTemp1",
            formatTemperature(
                firstWeather
                    .current
                    .temperature_2m
            )
        );


        setText(
            "compareCondition1",
            weatherCodeToText(
                firstWeather
                    .current
                    .weather_code
            )
        );


        setText(
            "compareTemp2",
            formatTemperature(
                secondWeather
                    .current
                    .temperature_2m
            )
        );


        setText(
            "compareCondition2",
            weatherCodeToText(
                secondWeather
                    .current
                    .weather_code
            )
        );


        const temp1 =
            safeNumber(
                firstWeather
                    .current
                    .temperature_2m
            );


        const temp2 =
            safeNumber(
                secondWeather
                    .current
                    .temperature_2m
            );


        let result =
            "Both locations have comparable current temperatures.";


        if (
            temp1 !== null &&
            temp2 !== null
        ) {

            if (
                temp1 > temp2
            ) {

                result =
                    `${firstLocation.name} is currently warmer by ${Math.abs(
                        temp1 - temp2
                    ).toFixed(1)}°C.`;

            } else if (
                temp2 > temp1
            ) {

                result =
                    `${secondLocation.name} is currently warmer by ${Math.abs(
                        temp1 - temp2
                    ).toFixed(1)}°C.`;
            }
        }


        setText(
            "comparisonResult",
            result
        );


    } catch (error) {

        setText(
            "comparisonResult",
            error.message
        );
    }
}


/* =========================================================
   SAVED LOCATIONS
========================================================= */

function saveRecentLocation(
    location
) {

    if (!location) return;


    const newLocation = {

        name:
            location.name,

        latitude:
            location.latitude,

        longitude:
            location.longitude,

        displayName:
            location.displayName
    };


    savedLocations =
        savedLocations.filter(
            item =>
                !(
                    Math.abs(
                        item.latitude -
                        newLocation.latitude
                    ) < 0.001 &&
                    Math.abs(
                        item.longitude -
                        newLocation.longitude
                    ) < 0.001
                )
        );


    savedLocations.unshift(
        newLocation
    );


    savedLocations =
        savedLocations.slice(
            0,
            6
        );


    localStorage.setItem(
        "weatherGPTSavedLocations",
        JSON.stringify(
            savedLocations
        )
    );


    renderSavedLocations();
}


/* =========================================================
   LOAD SAVED LOCATIONS
========================================================= */

function loadSavedLocations() {

    try {

        const stored =
            localStorage.getItem(
                "weatherGPTSavedLocations"
            );


        savedLocations =
            stored
                ? JSON.parse(stored)
                : [];


        if (
            !Array.isArray(
                savedLocations
            )
        ) {

            savedLocations =
                [];
        }


    } catch (error) {

        savedLocations =
            [];
    }


    renderSavedLocations();
}


/* =========================================================
   RENDER SAVED
========================================================= */

function renderSavedLocations() {

    const grid =
        getElement(
            "savedLocationGrid"
        );


    if (!grid) return;


    grid.innerHTML =
        "";


    if (
        savedLocations.length === 0
    ) {

        grid.innerHTML = `
            <div class="empty-saved">
                <i class="fa-solid fa-bookmark"></i>
                <span>Your searched locations will appear here.</span>
            </div>
        `;

        return;
    }


    savedLocations.forEach(
        location => {

            const button =
                document.createElement(
                    "button"
                );


            button.type =
                "button";


            button.className =
                "saved-location-card";


            button.innerHTML = `
                <i class="fa-solid fa-location-dot"></i>
                <span>
                    ${escapeHTML(
                        location.name
                    )}
                </span>
            `;


            button.addEventListener(
                "click",
                () => {

                    searchCity(
                        location.displayName ||
                        location.name
                    );
                }
            );


            grid.appendChild(
                button
            );
        }
    );
}


/* =========================================================
   POPULAR CITY
========================================================= */

function selectCity(
    city
) {

    const input =
        getElement(
            "cityInput"
        );


    if (input) {

        input.value =
            city;
    }


    searchCity(
        city
    );
}


/* =========================================================
   SEARCH SETUP
========================================================= */

function setupSearch() {

    const input =
        getElement(
            "cityInput"
        );


    if (!input) return;


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                searchWeather();
            }
        }
    );
}


function handleSearchKey(
    event
) {

    if (
        event.key ===
        "Enter"
    ) {

        event.preventDefault();

        searchWeather();
    }
}


/* =========================================================
   LOCATION SUGGESTIONS
========================================================= */

function setupLocationResults() {

    const input =
        getElement(
            "cityInput"
        );


    const results =
        getElement(
            "locationResults"
        );


    if (
        !input ||
        !results
    ) {
        return;
    }


    input.addEventListener(
        "input",
        () => {

            clearTimeout(
                searchTimer
            );


            const value =
                input.value.trim();


            if (
                value.length < 3
            ) {

                results.style.display =
                    "none";

                results.innerHTML =
                    "";

                return;
            }


            searchTimer =
                setTimeout(
                    async () => {

                        try {

                            const url =
                                `${GEO_API}?` +
                                `name=${encodeURIComponent(
                                    value
                                )}` +
                                `&count=6` +
                                `&language=en` +
                                `&format=json`;


                            const response =
                                await fetch(
                                    url
                                );


                            if (
                                !response.ok
                            ) {
                                return;
                            }


                            const data =
                                await response.json();


                            renderLocationSuggestions(
                                data.results ||
                                []
                            );


                        } catch (error) {

                            console.warn(
                                "Suggestion error:",
                                error
                            );
                        }

                    },
                    500
                );
        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !results.contains(
                    event.target
                ) &&
                event.target !==
                input
            ) {

                results.style.display =
                    "none";
            }
        }
    );
}


/* =========================================================
   RENDER SUGGESTIONS
========================================================= */

function renderLocationSuggestions(
    locations
) {

    const results =
        getElement(
            "locationResults"
        );


    if (!results) return;


    results.innerHTML =
        "";


    if (
        !Array.isArray(
            locations
        ) ||
        locations.length === 0
    ) {

        results.style.display =
            "none";

        return;
    }


    locations
        .slice(
            0,
            6
        )
        .forEach(
            location => {

                const button =
                    document.createElement(
                        "button"
                    );


                button.type =
                    "button";


                button.style.cssText = `
                    width:100%;
                    display:flex;
                    align-items:center;
                    gap:12px;
                    padding:13px 15px;
                    border:0;
                    border-bottom:1px solid var(--border);
                    background:transparent;
                    color:var(--text);
                    text-align:left;
                    cursor:pointer;
                `;


                button.innerHTML = `

                    <i
                        class="fa-solid fa-location-dot"
                        style="color:var(--accent);"
                    ></i>

                    <span>

                        <strong>
                            ${escapeHTML(
                                location.name ||
                                ""
                            )}
                        </strong>

                        <small
                            style="
                                display:block;
                                margin-top:3px;
                                color:var(--muted);
                            "
                        >
                            ${escapeHTML(
                                [
                                    location.admin1,
                                    location.country
                                ]
                                .filter(Boolean)
                                .join(", ")
                            )}
                        </small>

                    </span>
                `;


                button.addEventListener(
                    "click",
                    () => {

                        const normalized =
                            normalizeOpenMeteoLocation(
                                location
                            );


                        results.style.display =
                            "none";


                        const input =
                            getElement(
                                "cityInput"
                            );


                        if (input) {

                            input.value =
                                normalized.displayName;
                        }


                        searchCity(
                            normalized.displayName
                        );
                    }
                );


                results.appendChild(
                    button
                );
            }
        );


    results.style.display =
        "block";
}


/* =========================================================
   THEME
========================================================= */

function initializeTheme() {

    const saved =
        localStorage.getItem(
            "weatherGPTTheme"
        );


    if (
        saved ===
        "light"
    ) {

        document.body.classList.add(
            "light-theme"
        );
    }


    updateThemeIcon();
}


function toggleTheme() {

    document.body.classList.toggle(
        "light-theme"
    );


    const isLight =
        document.body.classList.contains(
            "light-theme"
        );


    localStorage.setItem(
        "weatherGPTTheme",
        isLight
            ? "light"
            : "dark"
    );


    updateThemeIcon();
}


function updateThemeIcon() {

    const button =
        document.querySelector(
            ".theme-btn"
        );


    if (!button) return;


    const icon =
        button.querySelector(
            "i"
        );


    if (!icon) return;


    const isLight =
        document.body.classList.contains(
            "light-theme"
        );


    icon.className =
        isLight
            ? "fa-solid fa-moon"
            : "fa-solid fa-sun";
}


/* =========================================================
   AI WEATHER ASSISTANT
========================================================= */

function setupAIChat() {

    const input =
        getElement(
            "question"
        );


    if (!input) return;


    input.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                askAI();
            }
        }
    );
}


/* =========================================================
   TOGGLE AI CHAT
========================================================= */

function toggleAIChat() {

    const windowElement =
        getElement(
            "aiChatWindow"
        );


    if (!windowElement) return;


    const isOpen =
        windowElement.style.display ===
        "flex";


    windowElement.style.display =
        isOpen
            ? "none"
            : "flex";
}


function closeAIChat() {

    const windowElement =
        getElement(
            "aiChatWindow"
        );


    if (windowElement) {

        windowElement.style.display =
            "none";
    }
}


/* =========================================================
   AI ANSWER
========================================================= */

function askAI(
    customQuestion = null
) {

    if (!currentWeather) {

        setAIAnswer(
            "Weather data is still loading. Please wait a moment and try again."
        );

        return;
    }


    const input =
        getElement(
            "question"
        );


    const question =
        customQuestion ||
        input?.value.trim();


    if (!question) {

        setAIAnswer(
            "Ask me something about the current weather, rain, travel, outdoor activities or temperature."
        );

        return;
    }


    const answer =
        generateWeatherAIAnswer(
            question
        );


    setAIAnswer(
        answer
    );


    if (
        input &&
        !customQuestion
    ) {

        input.value =
            "";
    }
}


function askQuickQuestion(
    question
) {

    askAI(
        question
    );
}


/* =========================================================
   WEATHER AI LOGIC
========================================================= */

function generateWeatherAIAnswer(
    question
) {

    const q =
        String(question)
            .toLowerCase()
            .trim();


    const data =
        currentWeather;


    if (
        !data ||
        !data.current
    ) {

        return "Live weather data is not available yet.";
    }


    const current =
        data.current;


    const temperature =
        safeNumber(
            current.temperature_2m
        );


    const feels =
        safeNumber(
            current.apparent_temperature
        );


    const humidity =
        safeNumber(
            current.relative_humidity_2m
        );


    const wind =
        safeNumber(
            current.wind_speed_10m
        );


    const rain =
        getNextRainProbability(
            data.hourly
        );


    const condition =
        weatherCodeToText(
            current.weather_code
        );


    const location =
        currentLocation?.name ||
        "this location";


    if (
        containsAny(
            q,
            [
                "rain",
                "barish",
                "बारिश",
                "umbrella",
                "छाता"
            ]
        )
    ) {

        if (
            rain !== null &&
            rain >= 70
        ) {

            return `
Rain probability is currently high at
${Math.round(rain)}%.
Check the hourly forecast before going outside.
            `.trim();
        }


        if (
            rain !== null &&
            rain >= 40
        ) {

            return `
There is a moderate rain possibility of
${Math.round(rain)}%.
Keep the hourly forecast in mind.
            `.trim();
        }


        return `
The current forecast shows a lower rain probability
of ${rain !== null ? Math.round(rain) : "--"}%.
Rain is not currently the dominant forecast signal.
        `.trim();
    }


    if (
        containsAny(
            q,
            [
                "temperature",
                "temp",
                "hot",
                "cold",
                "गरमी",
                "ठंड"
            ]
        )
    ) {

        return `
${location} is currently around
${temperature !== null ? formatTemperature(temperature) : "--"}.
It feels like
${feels !== null ? formatTemperature(feels) : "--"}.
        `.trim();
    }


    if (
        containsAny(
            q,
            [
                "travel",
                "trip",
                "journey",
                "यात्रा"
            ]
        )
    ) {

        if (
            rain !== null &&
            rain >= 70
        ) {

            return `
Travel may require extra planning because
rain probability is ${Math.round(rain)}%.
Check the hourly forecast before departure.
            `.trim();
        }


        if (
            wind !== null &&
            wind >= 35
        ) {

            return `
Wind speed is currently around
${Math.round(wind)} km/h.
Check the route forecast before travelling.
            `.trim();
        }


        return `
The current weather at ${location} is
${condition.toLowerCase()},
around ${temperature !== null ? formatTemperature(temperature) : "--"}.
No major immediate weather signal is detected,
but check the hourly forecast before departure.
        `.trim();
    }


    if (
        containsAny(
            q,
            [
                "exercise",
                "running",
                "run",
                "gym",
                "workout"
            ]
        )
    ) {

        const score =
            calculateActivityScore(
                data,
                "exercise"
            );


        return `
Your current exercise weather score is
${score}/100.
Temperature is ${
            temperature !== null
                ? formatTemperature(
                    temperature
                )
                : "--"
        },
wind is ${
            wind !== null
                ? Math.round(wind)
                : "--"
        } km/h,
and rain probability is ${
            rain !== null
                ? Math.round(rain)
                : "--"
        }%.
Check the hourly forecast for the best time.
        `.trim();
    }


    if (
        containsAny(
            q,
            [
                "humidity",
                "moisture",
                "नमी"
            ]
        )
    ) {

        return `
Current relative humidity is
${humidity !== null ? Math.round(humidity) : "--"}%.
        `.trim();
    }


    if (
        containsAny(
            q,
            [
                "wind",
                "हवा"
            ]
        )
    ) {

        return `
Current wind speed is approximately
${wind !== null ? Math.round(wind) : "--"} km/h.
        `.trim();
    }


    if (
        containsAny(
            q,
            [
                "weather",
                "forecast",
                "condition",
                "mausam",
                "मौसम"
            ]
        )
    ) {

        return `
${location} is currently experiencing
${condition.toLowerCase()} with a temperature of
${temperature !== null ? formatTemperature(temperature) : "--"}.
It feels like
${feels !== null ? formatTemperature(feels) : "--"},
humidity is
${humidity !== null ? Math.round(humidity) : "--"}%,
wind is around
${wind !== null ? Math.round(wind) : "--"} km/h,
and rain probability is
${rain !== null ? Math.round(rain) : "--"}%.
        `.trim();
    }


    return `
I can answer weather questions using the live
Weather GPT weather data. Try temperature, rain,
travel, wind, humidity, exercise or today's weather.
    `.trim();
}


/* =========================================================
   AI ANSWER UI
========================================================= */

function setAIAnswer(
    message
) {

    const answer =
        getElement(
            "answer"
        );


    if (!answer) return;


    answer.textContent =
        message;
}


/* =========================================================
   VOICE ALERT
========================================================= */

function speakCurrentAlert() {

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }


    const title =
        getElement(
            "alertTitle"
        )?.textContent ||
        "Weather alert";


    const message =
        getElement(
            "alertMessage"
        )?.textContent ||
        "Please check the latest weather forecast.";


    const speech =
        new SpeechSynthesisUtterance(
            `${title}. ${message}`
        );


    speech.rate =
        0.95;


    speech.pitch =
        1;


    window.speechSynthesis.cancel();


    window.speechSynthesis.speak(
        speech
    );
}


function stopVoiceAlert() {

    if (
        "speechSynthesis" in window
    ) {

        window.speechSynthesis.cancel();
    }
}


/* =========================================================
   UTILITY FUNCTIONS
========================================================= */

function findCurrentHourIndex(
    times
) {

    if (
        !Array.isArray(times) ||
        times.length === 0
    ) {

        return 0;
    }


    const now =
        Date.now();


    let closestIndex =
        0;


    let closestDifference =
        Infinity;


    times.forEach(
        (
            time,
            index
        ) => {

            const timestamp =
                new Date(
                    time
                ).getTime();


            const difference =
                Math.abs(
                    timestamp -
                    now
                );


            if (
                difference <
                closestDifference
            ) {

                closestDifference =
                    difference;


                closestIndex =
                    index;
            }
        }
    );


    return closestIndex;
}


function findHourByLocalHour(
    times,
    targetHour
) {

    if (
        !Array.isArray(times)
    ) {
        return -1;
    }


    for (
        let i = 0;
        i < times.length;
        i++
    ) {

        const date =
            new Date(
                times[i]
            );


        if (
            date.getHours() ===
            targetHour
        ) {

            return i;
        }
    }


    return -1;
}


function getNextRainProbability(
    hourly
) {

    if (
        !hourly ||
        !Array.isArray(
            hourly.precipitation_probability
        ) ||
        !Array.isArray(
            hourly.time
        )
    ) {

        return null;
    }


    const index =
        findCurrentHourIndex(
            hourly.time
        );


    return safeNumber(
        hourly
            .precipitation_probability[
                index
            ]
    );
}


/* =========================================================
   TEMPERATURE FORMAT
========================================================= */

function formatTemperature(
    celsius
) {

    const value =
        safeNumber(
            celsius
        );


    if (
        value === null
    ) {
        return "--";
    }


    if (isCelsius) {

        return `${Math.round(
            value
        )}°C`;
    }


    const fahrenheit =
        (
            value *
            9 /
            5
        ) +
        32;


    return `${Math.round(
        fahrenheit
    )}°F`;
}


/* =========================================================
   TEMPERATURE UNIT TOGGLE
========================================================= */

function toggleTemperatureUnit() {

    isCelsius =
        !isCelsius;


    if (!currentWeather) {
        return;
    }


    updateCurrentWeather(
        currentWeather,
        currentLocation
    );


    updateHourly(
        currentWeather
    );


    updateForecast(
        currentWeather
    );


    updateWeatherStory(
        currentWeather
    );


    /*
        Hero intentionally remains API
        Celsius value to keep the hero
        compact and consistent.
    */
}


/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(
    value
) {

    if (!value) {
        return "--";
    }


    const date =
        new Date(
            value
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "--";
    }


    return date.toLocaleTimeString(
        [],
        {
            hour:
                "numeric",

            minute:
                "2-digit"
        }
    );
}


/* =========================================================
   DAY FORMAT
========================================================= */

function formatDayName(
    value,
    index
) {

    if (
        index === 0
    ) {
        return "Today";
    }


    if (!value) {
        return "--";
    }


    const date =
        new Date(
            `${value}T12:00:00`
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "--";
    }


    return date.toLocaleDateString(
        [],
        {
            weekday:
                "short"
        }
    );
}


/* =========================================================
   VISIBILITY
========================================================= */

function formatVisibility(
    meters
) {

    const value =
        safeNumber(
            meters
        );


    if (
        value === null
    ) {
        return "--";
    }


    if (
        value >= 1000
    ) {

        return `${(
            value /
            1000
        ).toFixed(1)} km`;
    }


    return `${Math.round(
        value
    )} m`;
}


/* =========================================================
   DECISION DESCRIPTION
========================================================= */

function getDecisionDescription(
    score
) {

    if (
        score >= 85
    ) {

        return "Weather conditions look favorable for many outdoor plans.";
    }


    if (
        score >= 70
    ) {

        return "Conditions look generally good, with some factors worth monitoring.";
    }


    if (
        score >= 50
    ) {

        return "Some weather factors may affect outdoor plans. Check the hourly forecast.";
    }


    return "Weather conditions may require extra planning before outdoor activity.";
}


/* =========================================================
   GENERIC HELPERS
========================================================= */

function containsAny(
    text,
    words
) {

    return words.some(
        word =>
            text.includes(
                word
            )
    );
}


function escapeHTML(
    value
) {

    return String(
        value || ""
    )
    .replace(
        /&/g,
        "&amp;"
    )
    .replace(
        /</g,
        "&lt;"
    )
    .replace(
        />/g,
        "&gt;"
    )
    .replace(
        /"/g,
        "&quot;"
    )
    .replace(
        /'/g,
        "&#039;"
    );
}


/* =========================================================
   INPUT UPDATE
========================================================= */

function updateInputValue(
    location
) {

    const input =
        getElement(
            "cityInput"
        );


    if (
        !input ||
        !location
    ) {
        return;
    }


    input.value =
        location.displayName ||
        location.name ||
        "";
}


/* =========================================================
   LOADING
========================================================= */

function setLoading(
    loading
) {

    document.body.classList.toggle(
        "loading",
        loading
    );


    const searchButton =
        getElement(
            "searchBtn"
        );


    if (searchButton) {

        searchButton.disabled =
            loading;
    }


    if (loading) {

        setText(
            "mapStatus",
            "Loading live weather..."
        );
    }
}


/* =========================================================
   ERROR
========================================================= */

function showGlobalError(
    message
) {

    console.error(
        message
    );


    setText(
        "condition",
        "Unable to load"
    );


    setText(
        "locationAddress",
        message
    );


    setText(
        "weatherScore",
        "--"
    );


    setText(
        "scoreStatus",
        "Unavailable"
    );


    /*
        Do not show fake hero data.
    */

    setText(
        "heroTemperature",
        "--°"
    );


    setText(
        "heroRain",
        "--%"
    );


    setText(
        "heroWind",
        "-- km/h"
    );
}


function showMessage(
    id,
    message
) {

    const element =
        getElement(
            id
        );


    if (!element) {
        return;
    }


    element.setAttribute(
        "aria-label",
        message
    );


    element.focus();
}


/* =========================================================
   WINDOW EXPORTS
========================================================= */

window.searchWeather =
    searchWeather;


window.searchCity =
    searchCity;


window.getLocation =
    getLocation;


window.toggleTheme =
    toggleTheme;


window.toggleTemperatureUnit =
    toggleTemperatureUnit;


window.selectCity =
    selectCity;


window.selectProfession =
    selectProfession;


window.checkTravelWeather =
    checkTravelWeather;


window.compareWeather =
    compareWeather;


window.zoomIn =
    zoomIn;


window.zoomOut =
    zoomOut;


window.resetZoom =
    resetZoom;


window.toggleAIChat =
    toggleAIChat;


window.closeAIChat =
    closeAIChat;


window.askAI =
    askAI;


window.askQuickQuestion =
    askQuickQuestion;


window.speakCurrentAlert =
    speakCurrentAlert;


window.stopVoiceAlert =
    stopVoiceAlert;


window.handleSearchKey =
    handleSearchKey;


/* =========================================================
   FINAL CONSOLE
========================================================= */

console.log(
    "%cWeather GPT",
    "font-size:20px;font-weight:bold;color:#55c7ff;"
);

console.log(
    "Weather Intelligence & Decision Engine initialized."
);

console.log(
    "Live weather source: Open-Meteo"
);

console.log(
    "AQI source: Open-Meteo Air Quality API"
);