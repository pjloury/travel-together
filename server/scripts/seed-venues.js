#!/usr/bin/env node
// Seed venues table with global national parks and ski resorts.
// Run: node server/scripts/seed-venues.js

require('dotenv').config();
const db = require('../db');

const NATIONAL_PARKS = [
  // USA (63 national parks)
  { name: 'Acadia National Park', country: 'United States', region: 'Maine', latitude: 44.35, longitude: -68.21 },
  { name: 'Arches National Park', country: 'United States', region: 'Utah', latitude: 38.68, longitude: -109.57 },
  { name: 'Badlands National Park', country: 'United States', region: 'South Dakota', latitude: 43.75, longitude: -102.50 },
  { name: 'Big Bend National Park', country: 'United States', region: 'Texas', latitude: 29.25, longitude: -103.25 },
  { name: 'Biscayne National Park', country: 'United States', region: 'Florida', latitude: 25.48, longitude: -80.43 },
  { name: 'Black Canyon of the Gunnison National Park', country: 'United States', region: 'Colorado', latitude: 38.57, longitude: -107.72 },
  { name: 'Bryce Canyon National Park', country: 'United States', region: 'Utah', latitude: 37.57, longitude: -112.18 },
  { name: 'Canyonlands National Park', country: 'United States', region: 'Utah', latitude: 38.20, longitude: -109.93 },
  { name: 'Capitol Reef National Park', country: 'United States', region: 'Utah', latitude: 38.07, longitude: -111.17 },
  { name: 'Carlsbad Caverns National Park', country: 'United States', region: 'New Mexico', latitude: 32.15, longitude: -104.56 },
  { name: 'Channel Islands National Park', country: 'United States', region: 'California', latitude: 34.01, longitude: -119.78 },
  { name: 'Congaree National Park', country: 'United States', region: 'South Carolina', latitude: 33.79, longitude: -80.78 },
  { name: 'Crater Lake National Park', country: 'United States', region: 'Oregon', latitude: 42.94, longitude: -122.10 },
  { name: 'Cuyahoga Valley National Park', country: 'United States', region: 'Ohio', latitude: 41.24, longitude: -81.55 },
  { name: 'Death Valley National Park', country: 'United States', region: 'California', latitude: 36.53, longitude: -117.07 },
  { name: 'Denali National Park', country: 'United States', region: 'Alaska', latitude: 63.33, longitude: -150.50 },
  { name: 'Dry Tortugas National Park', country: 'United States', region: 'Florida', latitude: 24.63, longitude: -82.87 },
  { name: 'Everglades National Park', country: 'United States', region: 'Florida', latitude: 25.29, longitude: -80.93 },
  { name: 'Gates of the Arctic National Park', country: 'United States', region: 'Alaska', latitude: 67.78, longitude: -153.30 },
  { name: 'Gateway Arch National Park', country: 'United States', region: 'Missouri', latitude: 38.62, longitude: -90.18 },
  { name: 'Glacier National Park', country: 'United States', region: 'Montana', latitude: 48.70, longitude: -113.72 },
  { name: 'Glacier Bay National Park', country: 'United States', region: 'Alaska', latitude: 58.66, longitude: -136.90 },
  { name: 'Grand Canyon National Park', country: 'United States', region: 'Arizona', latitude: 36.06, longitude: -112.14 },
  { name: 'Grand Teton National Park', country: 'United States', region: 'Wyoming', latitude: 43.79, longitude: -110.70 },
  { name: 'Great Basin National Park', country: 'United States', region: 'Nevada', latitude: 38.98, longitude: -114.30 },
  { name: 'Great Sand Dunes National Park', country: 'United States', region: 'Colorado', latitude: 37.73, longitude: -105.51 },
  { name: 'Great Smoky Mountains National Park', country: 'United States', region: 'Tennessee', latitude: 35.61, longitude: -83.50 },
  { name: 'Guadalupe Mountains National Park', country: 'United States', region: 'Texas', latitude: 31.92, longitude: -104.87 },
  { name: 'Haleakalā National Park', country: 'United States', region: 'Hawaii', latitude: 20.72, longitude: -156.15 },
  { name: 'Hawaiʻi Volcanoes National Park', country: 'United States', region: 'Hawaii', latitude: 19.42, longitude: -155.26 },
  { name: 'Hot Springs National Park', country: 'United States', region: 'Arkansas', latitude: 34.52, longitude: -93.07 },
  { name: 'Indiana Dunes National Park', country: 'United States', region: 'Indiana', latitude: 41.65, longitude: -87.05 },
  { name: 'Isle Royale National Park', country: 'United States', region: 'Michigan', latitude: 48.10, longitude: -88.55 },
  { name: 'Joshua Tree National Park', country: 'United States', region: 'California', latitude: 33.88, longitude: -115.90 },
  { name: 'Katmai National Park', country: 'United States', region: 'Alaska', latitude: 58.50, longitude: -154.97 },
  { name: 'Kenai Fjords National Park', country: 'United States', region: 'Alaska', latitude: 59.92, longitude: -149.65 },
  { name: 'Kings Canyon National Park', country: 'United States', region: 'California', latitude: 36.89, longitude: -118.55 },
  { name: 'Kobuk Valley National Park', country: 'United States', region: 'Alaska', latitude: 67.55, longitude: -159.28 },
  { name: 'Lake Clark National Park', country: 'United States', region: 'Alaska', latitude: 60.97, longitude: -153.42 },
  { name: 'Lassen Volcanic National Park', country: 'United States', region: 'California', latitude: 40.49, longitude: -121.51 },
  { name: 'Mammoth Cave National Park', country: 'United States', region: 'Kentucky', latitude: 37.19, longitude: -86.10 },
  { name: 'Mesa Verde National Park', country: 'United States', region: 'Colorado', latitude: 37.18, longitude: -108.49 },
  { name: 'Mount Rainier National Park', country: 'United States', region: 'Washington', latitude: 46.85, longitude: -121.75 },
  { name: 'New River Gorge National Park', country: 'United States', region: 'West Virginia', latitude: 37.93, longitude: -80.98 },
  { name: 'North Cascades National Park', country: 'United States', region: 'Washington', latitude: 48.70, longitude: -121.21 },
  { name: 'Olympic National Park', country: 'United States', region: 'Washington', latitude: 47.97, longitude: -123.50 },
  { name: 'Petrified Forest National Park', country: 'United States', region: 'Arizona', latitude: 35.07, longitude: -109.78 },
  { name: 'Pinnacles National Park', country: 'United States', region: 'California', latitude: 36.49, longitude: -121.20 },
  { name: 'Redwood National Park', country: 'United States', region: 'California', latitude: 41.21, longitude: -124.00 },
  { name: 'Rocky Mountain National Park', country: 'United States', region: 'Colorado', latitude: 40.40, longitude: -105.58 },
  { name: 'Saguaro National Park', country: 'United States', region: 'Arizona', latitude: 32.20, longitude: -110.73 },
  { name: 'Sequoia National Park', country: 'United States', region: 'California', latitude: 36.43, longitude: -118.68 },
  { name: 'Shenandoah National Park', country: 'United States', region: 'Virginia', latitude: 38.53, longitude: -78.35 },
  { name: 'Theodore Roosevelt National Park', country: 'United States', region: 'North Dakota', latitude: 46.97, longitude: -103.45 },
  { name: 'Virgin Islands National Park', country: 'United States', region: 'US Virgin Islands', latitude: 18.33, longitude: -64.73 },
  { name: 'Voyageurs National Park', country: 'United States', region: 'Minnesota', latitude: 48.49, longitude: -92.84 },
  { name: 'White Sands National Park', country: 'United States', region: 'New Mexico', latitude: 32.78, longitude: -106.17 },
  { name: 'Wind Cave National Park', country: 'United States', region: 'South Dakota', latitude: 43.57, longitude: -103.48 },
  { name: 'Wrangell-St. Elias National Park', country: 'United States', region: 'Alaska', latitude: 61.71, longitude: -142.99 },
  { name: 'Yellowstone National Park', country: 'United States', region: 'Wyoming', latitude: 44.43, longitude: -110.59 },
  { name: 'Yosemite National Park', country: 'United States', region: 'California', latitude: 37.87, longitude: -119.54 },
  { name: 'Zion National Park', country: 'United States', region: 'Utah', latitude: 37.30, longitude: -113.05 },
  { name: 'Painted Desert / Petrified Forest', country: 'United States', region: 'Arizona', latitude: 35.07, longitude: -109.78 },

  // Canada
  { name: 'Banff National Park', country: 'Canada', region: 'Alberta', latitude: 51.50, longitude: -116.00 },
  { name: 'Jasper National Park', country: 'Canada', region: 'Alberta', latitude: 52.87, longitude: -117.95 },
  { name: 'Pacific Rim National Park', country: 'Canada', region: 'British Columbia', latitude: 49.00, longitude: -125.53 },
  { name: 'Fundy National Park', country: 'Canada', region: 'New Brunswick', latitude: 45.60, longitude: -65.00 },
  { name: 'Cape Breton Highlands National Park', country: 'Canada', region: 'Nova Scotia', latitude: 46.75, longitude: -60.65 },
  { name: 'Kootenay National Park', country: 'Canada', region: 'British Columbia', latitude: 50.93, longitude: -116.02 },
  { name: 'Yoho National Park', country: 'Canada', region: 'British Columbia', latitude: 51.50, longitude: -116.50 },
  { name: 'Gros Morne National Park', country: 'Canada', region: 'Newfoundland', latitude: 49.59, longitude: -57.77 },

  // South America
  { name: 'Torres del Paine National Park', country: 'Chile', region: 'Magallanes', latitude: -51.00, longitude: -73.00 },
  { name: 'Los Glaciares National Park', country: 'Argentina', region: 'Santa Cruz', latitude: -50.05, longitude: -73.00 },
  { name: 'Iguazú National Park', country: 'Argentina', region: 'Misiones', latitude: -25.67, longitude: -54.44 },
  { name: 'Galápagos National Park', country: 'Ecuador', region: 'Galápagos', latitude: -0.67, longitude: -90.55 },
  { name: 'Manu National Park', country: 'Peru', region: 'Madre de Dios', latitude: -11.77, longitude: -72.33 },
  { name: 'Amazon National Park', country: 'Brazil', region: 'Amazonas', latitude: -1.10, longitude: -62.32 },
  { name: 'Pantanal Matogrossense National Park', country: 'Brazil', region: 'Mato Grosso', latitude: -17.80, longitude: -57.57 },

  // Africa
  { name: 'Kruger National Park', country: 'South Africa', region: 'Limpopo', latitude: -23.99, longitude: 31.55 },
  { name: 'Serengeti National Park', country: 'Tanzania', region: 'Mara', latitude: -2.33, longitude: 34.83 },
  { name: 'Maasai Mara National Reserve', country: 'Kenya', region: 'Narok', latitude: -1.50, longitude: 35.17 },
  { name: 'Bwindi Impenetrable National Park', country: 'Uganda', region: 'Southwestern Uganda', latitude: -1.05, longitude: 29.68 },
  { name: 'Virunga National Park', country: 'Democratic Republic of Congo', region: 'North Kivu', latitude: -0.35, longitude: 29.45 },
  { name: 'Okavango Delta (Moremi)', country: 'Botswana', region: 'Northwest', latitude: -19.22, longitude: 23.17 },
  { name: 'Etosha National Park', country: 'Namibia', region: 'Oshikoto', latitude: -18.86, longitude: 16.33 },
  { name: 'Amboseli National Park', country: 'Kenya', region: 'Kajiado', latitude: -2.65, longitude: 37.25 },
  { name: 'Ngorongoro Conservation Area', country: 'Tanzania', region: 'Arusha', latitude: -3.22, longitude: 35.48 },

  // Europe
  { name: 'Swiss National Park', country: 'Switzerland', region: 'Graubünden', latitude: 46.66, longitude: 10.18 },
  { name: 'Plitvice Lakes National Park', country: 'Croatia', region: 'Lika-Senj', latitude: 44.88, longitude: 15.62 },
  { name: 'Vatnajökull National Park', country: 'Iceland', region: 'East Iceland', latitude: 64.42, longitude: -17.42 },
  { name: 'Þingvellir National Park', country: 'Iceland', region: 'Capital Region', latitude: 64.26, longitude: -21.13 },
  { name: 'Białowieża National Park', country: 'Poland', region: 'Podlaskie', latitude: 52.70, longitude: 23.87 },
  { name: 'Triglav National Park', country: 'Slovenia', region: 'Upper Carniola', latitude: 46.38, longitude: 13.87 },
  { name: 'Doñana National Park', country: 'Spain', region: 'Andalusia', latitude: 36.97, longitude: -6.42 },
  { name: 'Ordesa y Monte Perdido National Park', country: 'Spain', region: 'Aragon', latitude: 42.67, longitude: -0.05 },
  { name: 'Bavarian Forest National Park', country: 'Germany', region: 'Bavaria', latitude: 48.93, longitude: 13.37 },
  { name: 'Cairngorms National Park', country: 'United Kingdom', region: 'Scotland', latitude: 57.08, longitude: -3.53 },
  { name: 'Peak District National Park', country: 'United Kingdom', region: 'England', latitude: 53.35, longitude: -1.83 },
  { name: 'Vanoise National Park', country: 'France', region: 'Savoie', latitude: 45.35, longitude: 6.93 },
  { name: 'Mercantour National Park', country: 'France', region: 'Alpes-Maritimes', latitude: 44.18, longitude: 7.00 },
  { name: 'Gran Paradiso National Park', country: 'Italy', region: 'Aosta Valley', latitude: 45.52, longitude: 7.27 },
  { name: 'Stelvio National Park', country: 'Italy', region: 'Lombardy', latitude: 46.52, longitude: 10.60 },

  // Asia
  { name: 'Jiuzhaigou National Park', country: 'China', region: 'Sichuan', latitude: 33.27, longitude: 103.92 },
  { name: 'Zhangjiajie National Forest Park', country: 'China', region: 'Hunan', latitude: 29.35, longitude: 110.43 },
  { name: 'Huangshan (Yellow Mountain)', country: 'China', region: 'Anhui', latitude: 30.13, longitude: 118.17 },
  { name: 'Fuji-Hakone-Izu National Park', country: 'Japan', region: 'Kanagawa', latitude: 35.35, longitude: 138.73 },
  { name: 'Nikko National Park', country: 'Japan', region: 'Tochigi', latitude: 36.75, longitude: 139.50 },
  { name: 'Shiretoko National Park', country: 'Japan', region: 'Hokkaido', latitude: 44.07, longitude: 145.08 },
  { name: 'Kerinci Seblat National Park', country: 'Indonesia', region: 'West Sumatra', latitude: -2.07, longitude: 101.32 },
  { name: 'Komodo National Park', country: 'Indonesia', region: 'East Nusa Tenggara', latitude: -8.55, longitude: 119.47 },
  { name: 'Ha Long Bay', country: 'Vietnam', region: 'Quảng Ninh', latitude: 20.90, longitude: 107.18 },
  { name: 'Phong Nha-Kẻ Bàng National Park', country: 'Vietnam', region: 'Quảng Bình', latitude: 17.55, longitude: 106.30 },
  { name: 'Khao Yai National Park', country: 'Thailand', region: 'Nakhon Ratchasima', latitude: 14.43, longitude: 101.37 },

  // Oceania
  { name: 'Fiordland National Park', country: 'New Zealand', region: 'Southland', latitude: -45.41, longitude: 167.72 },
  { name: 'Tongariro National Park', country: 'New Zealand', region: 'Manawatu-Whanganui', latitude: -39.20, longitude: 175.57 },
  { name: 'Abel Tasman National Park', country: 'New Zealand', region: 'Nelson-Tasman', latitude: -40.93, longitude: 172.97 },
  { name: 'Uluru-Kata Tjuta National Park', country: 'Australia', region: 'Northern Territory', latitude: -25.35, longitude: 131.03 },
  { name: 'Daintree National Park', country: 'Australia', region: 'Queensland', latitude: -16.17, longitude: 145.42 },
  { name: 'Blue Mountains National Park', country: 'Australia', region: 'New South Wales', latitude: -33.73, longitude: 150.37 },
  { name: 'Kakadu National Park', country: 'Australia', region: 'Northern Territory', latitude: -12.87, longitude: 132.47 },

  // Central America / Caribbean
  { name: 'Corcovado National Park', country: 'Costa Rica', region: 'Puntarenas', latitude: 8.49, longitude: -83.58 },
  { name: 'Manuel Antonio National Park', country: 'Costa Rica', region: 'Puntarenas', latitude: 9.39, longitude: -84.14 },
  { name: 'Arenal Volcano National Park', country: 'Costa Rica', region: 'Alajuela', latitude: 10.46, longitude: -84.70 },

  // Middle East
  { name: 'Wadi Rum Protected Area', country: 'Jordan', region: 'Aqaba', latitude: 29.57, longitude: 35.42 },
  { name: 'Dana Biosphere Reserve', country: 'Jordan', region: 'Ma\'an', latitude: 30.68, longitude: 35.60 },
];

const SKI_RESORTS = [
  // USA
  { name: 'Vail Mountain Resort', country: 'United States', region: 'Colorado', latitude: 39.64, longitude: -106.37 },
  { name: 'Aspen Mountain', country: 'United States', region: 'Colorado', latitude: 39.19, longitude: -106.82 },
  { name: 'Aspen Snowmass', country: 'United States', region: 'Colorado', latitude: 39.21, longitude: -106.95 },
  { name: 'Park City Mountain Resort', country: 'United States', region: 'Utah', latitude: 40.65, longitude: -111.50 },
  { name: 'Mammoth Mountain', country: 'United States', region: 'California', latitude: 37.65, longitude: -119.03 },
  { name: 'Steamboat Ski Resort', country: 'United States', region: 'Colorado', latitude: 40.48, longitude: -106.83 },
  { name: 'Breckenridge Ski Resort', country: 'United States', region: 'Colorado', latitude: 39.48, longitude: -106.07 },
  { name: 'Telluride Ski Resort', country: 'United States', region: 'Colorado', latitude: 37.94, longitude: -107.81 },
  { name: 'Jackson Hole Mountain Resort', country: 'United States', region: 'Wyoming', latitude: 43.58, longitude: -110.83 },
  { name: 'Sun Valley Resort', country: 'United States', region: 'Idaho', latitude: 43.69, longitude: -114.35 },
  { name: 'Heavenly Mountain Resort', country: 'United States', region: 'California', latitude: 38.93, longitude: -119.94 },
  { name: 'Snowbird Ski Resort', country: 'United States', region: 'Utah', latitude: 40.58, longitude: -111.65 },
  { name: 'Alta Ski Area', country: 'United States', region: 'Utah', latitude: 40.59, longitude: -111.64 },
  { name: 'Stowe Mountain Resort', country: 'United States', region: 'Vermont', latitude: 44.47, longitude: -72.68 },
  { name: 'Killington Resort', country: 'United States', region: 'Vermont', latitude: 43.67, longitude: -72.78 },
  { name: 'Taos Ski Valley', country: 'United States', region: 'New Mexico', latitude: 36.60, longitude: -105.45 },
  { name: 'Deer Valley Resort', country: 'United States', region: 'Utah', latitude: 40.63, longitude: -111.48 },
  { name: 'Squaw Valley (Palisades Tahoe)', country: 'United States', region: 'California', latitude: 39.20, longitude: -120.24 },
  { name: 'Big Sky Resort', country: 'United States', region: 'Montana', latitude: 45.28, longitude: -111.40 },
  { name: 'Copper Mountain Resort', country: 'United States', region: 'Colorado', latitude: 39.50, longitude: -106.16 },
  { name: 'Keystone Resort', country: 'United States', region: 'Colorado', latitude: 39.60, longitude: -105.97 },
  { name: 'Arapahoe Basin', country: 'United States', region: 'Colorado', latitude: 39.64, longitude: -105.87 },
  { name: 'Crystal Mountain', country: 'United States', region: 'Washington', latitude: 46.93, longitude: -121.47 },
  { name: 'Stratton Mountain Resort', country: 'United States', region: 'Vermont', latitude: 43.10, longitude: -72.90 },
  { name: 'Sunday River Ski Resort', country: 'United States', region: 'Maine', latitude: 44.47, longitude: -70.85 },
  { name: 'Sugarbush Resort', country: 'United States', region: 'Vermont', latitude: 44.13, longitude: -72.90 },

  // Canada
  { name: 'Whistler Blackcomb', country: 'Canada', region: 'British Columbia', latitude: 50.12, longitude: -122.95 },
  { name: 'Mont-Tremblant', country: 'Canada', region: 'Quebec', latitude: 46.12, longitude: -74.60 },
  { name: 'Banff Sunshine Village', country: 'Canada', region: 'Alberta', latitude: 51.08, longitude: -115.77 },
  { name: 'Lake Louise Ski Resort', country: 'Canada', region: 'Alberta', latitude: 51.43, longitude: -116.18 },
  { name: 'Revelstoke Mountain Resort', country: 'Canada', region: 'British Columbia', latitude: 51.00, longitude: -118.17 },
  { name: 'Big White Ski Resort', country: 'Canada', region: 'British Columbia', latitude: 49.72, longitude: -118.93 },
  { name: 'Silver Star Mountain Resort', country: 'Canada', region: 'British Columbia', latitude: 50.35, longitude: -119.05 },

  // Switzerland
  { name: 'Verbier', country: 'Switzerland', region: 'Valais', latitude: 46.10, longitude: 7.22 },
  { name: 'Zermatt', country: 'Switzerland', region: 'Valais', latitude: 46.02, longitude: 7.75 },
  { name: 'St. Moritz', country: 'Switzerland', region: 'Graubünden', latitude: 46.50, longitude: 9.84 },
  { name: 'Davos', country: 'Switzerland', region: 'Graubünden', latitude: 46.80, longitude: 9.84 },
  { name: 'Saas-Fee', country: 'Switzerland', region: 'Valais', latitude: 46.11, longitude: 7.93 },
  { name: 'Grindelwald', country: 'Switzerland', region: 'Bern', latitude: 46.62, longitude: 8.04 },
  { name: 'Wengen', country: 'Switzerland', region: 'Bern', latitude: 46.61, longitude: 7.92 },

  // France
  { name: 'Chamonix', country: 'France', region: 'Haute-Savoie', latitude: 45.92, longitude: 6.87 },
  { name: 'Courchevel', country: 'France', region: 'Savoie', latitude: 45.41, longitude: 6.63 },
  { name: "Val d'Isère", country: 'France', region: 'Savoie', latitude: 45.45, longitude: 6.98 },
  { name: 'Méribel', country: 'France', region: 'Savoie', latitude: 45.40, longitude: 6.56 },
  { name: 'Les Arcs', country: 'France', region: 'Savoie', latitude: 45.57, longitude: 6.83 },
  { name: 'La Plagne', country: 'France', region: 'Savoie', latitude: 45.51, longitude: 6.68 },
  { name: 'Tignes', country: 'France', region: 'Savoie', latitude: 45.47, longitude: 6.90 },
  { name: 'Alpe d\'Huez', country: 'France', region: 'Isère', latitude: 45.09, longitude: 6.07 },
  { name: 'Les Deux Alpes', country: 'France', region: 'Isère', latitude: 45.01, longitude: 6.12 },
  { name: 'Serre Chevalier', country: 'France', region: 'Hautes-Alpes', latitude: 44.93, longitude: 6.55 },
  { name: 'Megève', country: 'France', region: 'Haute-Savoie', latitude: 45.86, longitude: 6.62 },

  // Austria
  { name: 'St. Anton am Arlberg', country: 'Austria', region: 'Tyrol', latitude: 47.13, longitude: 10.27 },
  { name: 'Kitzbühel', country: 'Austria', region: 'Tyrol', latitude: 47.45, longitude: 12.39 },
  { name: 'Ischgl', country: 'Austria', region: 'Tyrol', latitude: 47.01, longitude: 10.29 },
  { name: 'Mayrhofen', country: 'Austria', region: 'Tyrol', latitude: 47.17, longitude: 11.87 },
  { name: 'Sölden', country: 'Austria', region: 'Tyrol', latitude: 46.96, longitude: 11.00 },
  { name: 'Lech am Arlberg', country: 'Austria', region: 'Vorarlberg', latitude: 47.21, longitude: 10.14 },
  { name: 'Saalbach-Hinterglemm', country: 'Austria', region: 'Salzburg', latitude: 47.39, longitude: 12.63 },
  { name: 'Bad Gastein', country: 'Austria', region: 'Salzburg', latitude: 47.11, longitude: 13.13 },

  // Italy
  { name: 'Cortina d\'Ampezzo', country: 'Italy', region: 'Veneto', latitude: 46.54, longitude: 12.14 },
  { name: 'Madonna di Campiglio', country: 'Italy', region: 'Trentino', latitude: 46.22, longitude: 10.83 },
  { name: 'Courmayeur', country: 'Italy', region: 'Aosta Valley', latitude: 45.79, longitude: 6.97 },
  { name: 'Livigno', country: 'Italy', region: 'Lombardy', latitude: 46.54, longitude: 10.13 },
  { name: 'Sestriere', country: 'Italy', region: 'Piedmont', latitude: 44.95, longitude: 6.88 },
  { name: 'Val Gardena (Selva)', country: 'Italy', region: 'South Tyrol', latitude: 46.56, longitude: 11.76 },

  // Japan
  { name: 'Niseko United', country: 'Japan', region: 'Hokkaido', latitude: 42.81, longitude: 140.69 },
  { name: 'Hakuba Valley', country: 'Japan', region: 'Nagano', latitude: 36.70, longitude: 137.86 },
  { name: 'Furano Ski Resort', country: 'Japan', region: 'Hokkaido', latitude: 43.35, longitude: 142.38 },
  { name: 'Rusutsu Resort', country: 'Japan', region: 'Hokkaido', latitude: 42.74, longitude: 140.88 },
  { name: 'Nozawa Onsen', country: 'Japan', region: 'Nagano', latitude: 36.92, longitude: 138.45 },
  { name: 'Shiga Kogen', country: 'Japan', region: 'Nagano', latitude: 36.73, longitude: 138.47 },

  // New Zealand / Australia
  { name: 'Queenstown Ski Area (The Remarkables)', country: 'New Zealand', region: 'Otago', latitude: -45.03, longitude: 168.66 },
  { name: 'Wanaka (Treble Cone)', country: 'New Zealand', region: 'Otago', latitude: -44.60, longitude: 168.81 },
  { name: 'Perisher Ski Resort', country: 'Australia', region: 'New South Wales', latitude: -36.41, longitude: 148.41 },
  { name: 'Thredbo Alpine Resort', country: 'Australia', region: 'New South Wales', latitude: -36.50, longitude: 148.30 },
  { name: 'Falls Creek Resort', country: 'Australia', region: 'Victoria', latitude: -36.87, longitude: 147.28 },

  // South America
  { name: 'Portillo', country: 'Chile', region: 'Valparaíso', latitude: -32.55, longitude: -70.13 },
  { name: 'Valle Nevado', country: 'Chile', region: 'Metropolitana', latitude: -33.36, longitude: -70.28 },
  { name: 'El Colorado', country: 'Chile', region: 'Metropolitana', latitude: -33.35, longitude: -70.28 },
  { name: 'Bariloche (Cerro Catedral)', country: 'Argentina', region: 'Río Negro', latitude: -41.20, longitude: -71.45 },

  // Norway/Sweden/Finland
  { name: 'Hemsedal Ski Resort', country: 'Norway', region: 'Viken', latitude: 60.87, longitude: 8.57 },
  { name: 'Åre Ski Resort', country: 'Sweden', region: 'Jämtland', latitude: 63.40, longitude: 13.07 },
  { name: 'Levi Ski Resort', country: 'Finland', region: 'Lapland', latitude: 67.80, longitude: 24.80 },

  // Georgia (country)
  { name: 'Gudauri Ski Resort', country: 'Georgia', region: 'Mtskheta-Mtianeti', latitude: 42.48, longitude: 44.47 },

  // Andorra
  { name: 'Grandvalira', country: 'Andorra', region: 'Encamp', latitude: 42.54, longitude: 1.73 },
];

async function seed() {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Enable pg_trgm if not already enabled
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    } catch (e) {
      // may not have superuser; skip silently
    }

    const inserted = { national_park: 0, ski_resort: 0 };

    for (const park of NATIONAL_PARKS) {
      await client.query(
        `INSERT INTO venues (name, type, country, region, latitude, longitude)
         VALUES ($1, 'national_park', $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [park.name, park.country, park.region, park.latitude, park.longitude]
      );
      inserted.national_park++;
    }

    for (const resort of SKI_RESORTS) {
      await client.query(
        `INSERT INTO venues (name, type, country, region, latitude, longitude)
         VALUES ($1, 'ski_resort', $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [resort.name, resort.country, resort.region, resort.latitude, resort.longitude]
      );
      inserted.ski_resort++;
    }

    await client.query('COMMIT');
    console.log(`Seeded ${inserted.national_park} national parks, ${inserted.ski_resort} ski resorts.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
