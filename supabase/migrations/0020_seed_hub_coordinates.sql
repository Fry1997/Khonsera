-- Seed coordinates for commonly-used transport hubs.
-- These enable route previews and feasibility checks for transport
-- booking stops. Coordinates sourced from public rail/airport data.

-- UK Rail Stations
UPDATE transport_hubs SET latitude = 52.3028, longitude = -0.6938 WHERE code = 'WLB'; -- Wellingborough
UPDATE transport_hubs SET latitude = 52.4778, longitude = -1.8981 WHERE code = 'BHM'; -- Birmingham New Street
UPDATE transport_hubs SET latitude = 53.4075, longitude = -2.9774 WHERE code = 'LIV'; -- Liverpool Lime Street
UPDATE transport_hubs SET latitude = 51.5284, longitude = -0.1260 WHERE code = 'KGX'; -- London Kings Cross
UPDATE transport_hubs SET latitude = 51.5279, longitude = -0.1339 WHERE code = 'STP'; -- London St Pancras
UPDATE transport_hubs SET latitude = 51.5178, longitude = -0.0821 WHERE code = 'LST'; -- London Liverpool Street
UPDATE transport_hubs SET latitude = 51.5302, longitude = -0.1240 WHERE code = 'EUS'; -- London Euston
UPDATE transport_hubs SET latitude = 52.0407, longitude = -0.7724 WHERE code = 'MKC'; -- Milton Keynes Central
UPDATE transport_hubs SET latitude = 53.4774, longitude = -2.2309 WHERE code = 'MAN'; -- Manchester Piccadilly
UPDATE transport_hubs SET latitude = 51.4499, longitude = -2.5812 WHERE code = 'BRI'; -- Bristol Temple Meads
UPDATE transport_hubs SET latitude = 52.9517, longitude = -1.1473 WHERE code = 'NOT'; -- Nottingham
UPDATE transport_hubs SET latitude = 52.2478, longitude = -0.8895 WHERE code = 'NMP'; -- Northampton
UPDATE transport_hubs SET latitude = 53.9590, longitude = -1.0926 WHERE code = 'YRK'; -- York
UPDATE transport_hubs SET latitude = 52.8794, longitude = -1.2504 WHERE code = 'EMD'; -- East Midlands Parkway
UPDATE transport_hubs SET latitude = 55.8586, longitude = -4.2586 WHERE code = 'GLC'; -- Glasgow Central
UPDATE transport_hubs SET latitude = 55.9520, longitude = -3.1892 WHERE code = 'EDB'; -- Edinburgh Waverley
UPDATE transport_hubs SET latitude = 51.5032, longitude = -0.1133 WHERE code = 'WAT'; -- London Waterloo
UPDATE transport_hubs SET latitude = 51.5154, longitude = -0.1755 WHERE code = 'PAD'; -- London Paddington
UPDATE transport_hubs SET latitude = 53.7528, longitude = -2.2580 WHERE code = 'BLN'; -- Blackburn (Lancashire)
UPDATE transport_hubs SET latitude = 52.5608, longitude = -1.8141 WHERE code = 'BMO'; -- Birmingham Moor Street
UPDATE transport_hubs SET latitude = 53.0929, longitude = -0.5386 WHERE code = 'GRA'; -- Grantham

-- UK Airports
UPDATE transport_hubs SET latitude = 51.4700, longitude = -0.4543 WHERE code = 'LHR'; -- Heathrow
UPDATE transport_hubs SET latitude = 51.1537, longitude = -0.1821 WHERE code = 'LGW'; -- Gatwick
UPDATE transport_hubs SET latitude = 53.3537, longitude = -2.2750 WHERE code = 'MAN' AND kind = 'airport'; -- Manchester Airport
UPDATE transport_hubs SET latitude = 52.8311, longitude = -1.3278 WHERE code = 'EMA'; -- East Midlands Airport
UPDATE transport_hubs SET latitude = 51.8747, longitude = 0.2389 WHERE code = 'STN'; -- Stansted
UPDATE transport_hubs SET latitude = 51.5048, longitude = 0.0495 WHERE code = 'LCY'; -- London City
UPDATE transport_hubs SET latitude = 53.8659, longitude = -1.6606 WHERE code = 'LBA'; -- Leeds Bradford
UPDATE transport_hubs SET latitude = 53.3337, longitude = -2.8497 WHERE code = 'LPL'; -- Liverpool John Lennon
UPDATE transport_hubs SET latitude = 55.9500, longitude = -3.3725 WHERE code = 'EDI'; -- Edinburgh Airport
UPDATE transport_hubs SET latitude = 51.3827, longitude = -2.7191 WHERE code = 'BRS'; -- Bristol Airport
