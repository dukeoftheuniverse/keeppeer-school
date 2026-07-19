import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Real-time weather + school safety monitor using wttr.in (free, no API key)
// Default location: General Santos City, Philippines (Labangal Elementary School area)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let location = 'General Santos City';
    try {
      const schools = await base44.asServiceRole.entities.School.list();
      const school = schools[0];
      if (school?.address && /davao/i.test(String(school.address))) location = 'Davao City';
      else if (school?.address && /manila/i.test(String(school.address))) location = 'Manila';
      else if (school?.address && /general\s+santos|gensan/i.test(String(school.address))) location = 'General Santos City';
    } catch (e) { /* use default */ }

    const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'KeepPeer-School/1.0' } });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return Response.json({ error: 'Weather service unavailable', status: resp.status, body: body.slice(0, 200) }, { status: 502 });
    }
    const data = await resp.json();

    const cur = data.current_condition?.[0] || {};
    const weather = data.weather || [];
    const today = weather[0] || {};

    const tempC = parseFloat(cur.temp_C);
    const feelsC = parseFloat(cur.FeelsLikeC);
    const humidity = parseInt(cur.humidity, 10);
    const precip = parseFloat(cur.precipMM);
    const windKmph = parseInt(cur.windspeedKmph, 10);
    const gustKmph = parseInt(cur.WindGustKmph, 10);
    const windDir = parseInt(cur.winddirDegree, 10);
    const wmoCode = parseInt(cur.weatherCode, 10);
    const desc = cur.weatherDesc?.[0]?.value || 'Clear';

    // wttr.in weatherCode is a WMO code; derive icon
    const icon = wmoIcon(wmoCode);
    const description = desc.replace(/^[a-z]/, (c) => c.toLowerCase());

    const todayRainSum = parseFloat(today.totalSnow_cm || '0') + parseFloat(today.hourly?.reduce((sum, h) => sum + parseFloat(h.precipMM || '0'), 0) || '0');
    const rainProb = Math.max(...(today.hourly || []).map(h => parseInt(h.chanceofrain || '0', 10)));
    const maxWind = Math.max(...(today.hourly || []).map(h => parseInt(h.WindGustKmph || h.windspeedKmph || '0', 10)));
    const maxTemp = parseFloat(today.maxtempC);
    const minTemp = parseFloat(today.mintempC);

    // Safety analysis (PAGASA-inspired thresholds)
    let safety = 'safe';
    let alert = '';
    let advisory = 'Conditions are safe for school activities.';

    const descLower = desc.toLowerCase();
    const isThunderstorm = descLower.includes('thunder') || descLower.includes('lightning');
    const isHeavyRain = descLower.includes('heavy rain') || descLower.includes('torrential') || precip >= 15;
    const isModerateRain = descLower.includes('rain') || descLower.includes('shower') || precip >= 2;

    if (isThunderstorm || maxWind >= 88) {
      safety = 'unsafe';
      alert = 'Class Suspension Recommended';
      advisory = 'Severe weather detected (thunderstorm or typhoon-strength winds). PAGASA guidelines recommend suspending face-to-face classes. Keep students safe indoors.';
    } else if (isHeavyRain || maxWind >= 60 || todayRainSum >= 30) {
      safety = 'warning';
      alert = 'Caution — Heavy Rain / Strong Winds';
      advisory = 'Heavy rainfall or strong winds expected. Monitor PAGASA bulletins. Consider modular distance learning for affected areas.';
    } else if (isModerateRain || maxWind >= 40 || todayRainSum >= 10) {
      safety = 'watch';
      alert = 'Weather Watch';
      advisory = 'Moderate rain or breezy conditions. Students should bring rain gear. No suspension advised.';
    }

    // 3-day forecast
    const forecast = weather.slice(0, 3).map((d, i) => {
      const fCode = parseInt(d.hourly?.[4]?.weatherCode || cur.weatherCode, 10);
      return {
        date: d.date,
        code: fCode,
        desc: (d.hourly?.[4]?.weatherDesc?.[0]?.value || desc),
        icon: wmoIcon(fCode),
        temp_max: parseFloat(d.maxtempC),
        temp_min: parseFloat(d.mintempC),
        rain_prob: Math.max(...(d.hourly || []).map(h => parseInt(h.chanceofrain || '0', 10))),
        rain_sum: (d.hourly || []).reduce((s, h) => s + parseFloat(h.precipMM || '0'), 0),
        wind_max: Math.max(...(d.hourly || []).map(h => parseInt(h.WindGustKmph || h.windspeedKmph || '0', 10))),
      };
    });

    return Response.json({
      location,
      current: {
        temperature: tempC,
        apparent: feelsC,
        humidity,
        precipitation: precip,
        weather_code: wmoCode,
        description,
        icon,
        wind_speed: windKmph,
        wind_gusts: gustKmph,
        wind_direction: windDir,
        observed_at: cur.localObsDateTime || new Date().toISOString(),
      },
      today: {
        rain_sum: todayRainSum,
        rain_prob: rainProb,
        max_wind: maxWind,
        max_gust: maxWind,
        max_temp: maxTemp,
        min_temp: minTemp,
      },
      forecast,
      safety,
      alert,
      advisory,
      source: 'wttr.in',
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function wmoIcon(code) {
  const c = parseInt(code, 10);
  if (c === 113) return 'sun';
  if (c === 116) return 'cloud-sun';
  if (c === 119 || c === 122) return 'cloud';
  if (c === 143 || c === 248 || c === 260) return 'fog';
  if (c >= 176 && c <= 182) return 'cloud-rain';
  if (c >= 185 && c <= 200) return 'snow';
  if (c >= 227 && c <= 230) return 'snow';
  if (c >= 263 && c <= 284) return 'cloud-rain';
  if (c >= 293 && c <= 308) return 'cloud-rain';
  if (c >= 311 && c <= 320) return 'cloud-rain';
  if (c >= 323 && c <= 338) return 'snow';
  if (c >= 350 && c <= 365) return 'cloud-rain';
  if (c === 377 || c === 371) return 'snow';
  if (c === 386 || c === 389 || c === 392 || c === 395) return 'cloud-lightning';
  if (c === 200 || c === 386 || c === 389) return 'cloud-lightning';
  return 'cloud';
}