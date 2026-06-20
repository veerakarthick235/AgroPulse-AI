import { useState, useEffect, useRef } from 'react';
import Navbar from '../../components/layout/Navbar';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Search, MapPin, Wind, Droplets, Eye, Thermometer, Gauge, Sunrise, Sunset } from 'lucide-react';

// ─── Weather Background Animations ───────────────────────────────────────────

function WeatherBackground({ condition }) {
  const isDayTime = new Date().getHours() >= 6 && new Date().getHours() < 19;

  if (!condition) return <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-800" />;

  const code = condition.id;
  const isThunder = code >= 200 && code < 300;
  const isDrizzle = code >= 300 && code < 400;
  const isRain = (code >= 400 && code < 600) || isDrizzle;
  const isSnow = code >= 600 && code < 700;
  const isMist = code >= 700 && code < 800;
  const isClear = code === 800;
  const isCloudy = code > 800;

  if (isClear && isDayTime) return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200" />
      <div className="absolute top-10 left-1/4 w-32 h-12 bg-white/60 rounded-full blur-md animate-drift" style={{ animationDuration: '25s' }} />
      <div className="absolute top-16 right-1/4 w-24 h-8 bg-white/50 rounded-full blur-md animate-drift" style={{ animationDuration: '20s', animationDelay: '5s' }} />
      {/* Sun */}
      <div className="absolute top-12 right-16 w-20 h-20 bg-yellow-300 rounded-full shadow-[0_0_60px_20px_rgba(253,224,71,0.5)] animate-pulse-slow" />
    </div>
  );

  if (isClear && !isDayTime) return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950" />
      {/* Stars */}
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            width: Math.random() * 2 + 1 + 'px',
            height: Math.random() * 2 + 1 + 'px',
            top: Math.random() * 70 + '%',
            left: Math.random() * 100 + '%',
            animationDelay: Math.random() * 2 + 's',
            animationDuration: (1.5 + Math.random()) + 's',
          }}
        />
      ))}
      {/* Moon */}
      <div className="absolute top-10 right-16 w-16 h-16 bg-yellow-100 rounded-full shadow-[0_0_30px_10px_rgba(253,224,71,0.2)]" />
    </div>
  );

  if (isRain || isThunder) return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-700 via-slate-600 to-slate-500" />
      {/* Rain drops */}
      {Array.from({ length: 60 }).map((_, i) => (
        <div key={i}
          className="absolute bg-blue-200/50 rounded-full animate-rain"
          style={{
            width: '1.5px',
            height: (20 + Math.random() * 30) + 'px',
            left: Math.random() * 100 + '%',
            top: '-50px',
            animationDuration: (0.6 + Math.random() * 0.4) + 's',
            animationDelay: Math.random() * 2 + 's',
          }}
        />
      ))}
      {isThunder && <div className="absolute inset-0 bg-yellow-200/10 animate-lightning" />}
    </div>
  );

  if (isSnow) return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-400 to-slate-200" />
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i}
          className="absolute bg-white rounded-full animate-rain"
          style={{
            width: (4 + Math.random() * 4) + 'px',
            height: (4 + Math.random() * 4) + 'px',
            left: Math.random() * 100 + '%',
            top: '-20px',
            animationDuration: (2 + Math.random() * 2) + 's',
            animationDelay: Math.random() * 3 + 's',
          }}
        />
      ))}
    </div>
  );

  if (isMist) return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-500 to-gray-300" />
      <div className="absolute inset-0 bg-white/30 backdrop-blur-sm" />
    </div>
  );

  // Cloudy default
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-gray-600 via-gray-500 to-gray-400" />
      <div className="absolute top-10 left-1/3 w-48 h-20 bg-white/40 rounded-full blur-md animate-drift" style={{ animationDuration: '18s' }} />
      <div className="absolute top-20 right-1/4 w-36 h-16 bg-white/30 rounded-full blur-md animate-drift" style={{ animationDuration: '22s', animationDelay: '3s' }} />
    </div>
  );
}

// ─── Main Weather Page ────────────────────────────────────────────────────────

export default function WeatherPage() {
  const [city, setCity] = useState('Coimbatore');
  const [input, setInput] = useState('');
  const [weather, setWeather] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adviceLoading, setAdviceLoading] = useState(false);

  const fetchWeather = async (targetCity) => {
    setLoading(true);
    try {
      const res = await api.get(`/weather?city=${encodeURIComponent(targetCity)}`);
      setWeather(res.data);

      // Also fetch advice
      setAdviceLoading(true);
      try {
        const advRes = await api.get(`/weather-intelligence?city=${encodeURIComponent(targetCity)}`);
        setAdvice(advRes.data);
      } catch { }
      finally { setAdviceLoading(false); }

    } catch (e) {
      toast.error(e.response?.data?.error || 'City not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWeather(city); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setCity(input.trim());
    fetchWeather(input.trim());
    setInput('');
  };

  const getWeatherEmoji = (id) => {
    if (!id) return '🌤️';
    if (id < 300) return '⛈️';
    if (id < 400) return '🌦️';
    if (id < 600) return '🌧️';
    if (id < 700) return '❄️';
    if (id < 800) return '🌫️';
    if (id === 800) return '☀️';
    if (id <= 803) return '⛅';
    return '☁️';
  };

  const formatTemp = (t) => Math.round(t);
  const formatTime = (unix) => new Date(unix * 1000).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const condition = weather?.current?.weather?.[0];

  // Parse 7-day forecast from backend
  const forecastDays = weather?.daily
    ? weather.daily.slice(0, 7).map(item => {
        const date = new Date(item.dt * 1000).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });
        return [date, item];
      })
    : null;

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <Navbar />

      {/* Animated Background */}
      <WeatherBackground condition={condition} />

      {/* Content */}
      <div className="relative z-10 pt-20 min-h-screen flex flex-col">
        <div className="flex-1 max-w-4xl mx-auto w-full px-6 py-10">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-3 mb-10 max-w-md mx-auto">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Search city..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
              />
            </div>
            <button type="submit" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white font-semibold px-5 py-3 rounded-2xl transition-all">
              Search
            </button>
          </form>

          {loading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-white/70">Fetching weather data...</p>
            </div>
          )}

          {weather && !loading && (
            <div className="animate-fade-in">
              {/* Main Weather Card */}
              <div className="glass rounded-3xl p-8 mb-6 text-white shadow-2xl">
                <div className="flex items-start justify-between flex-wrap gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={16} className="text-white/60" />
                      <span className="text-white/80 font-medium">{weather.city_name || weather.timezone}</span>
                    </div>
                    <div className="text-8xl font-black mb-2">
                      {formatTemp(weather.current?.temp)}°C
                    </div>
                    <p className="text-white/70 text-xl capitalize">{condition?.description}</p>
                    <div className="flex gap-4 mt-3 text-white/60 text-sm">
                      <span>Feels like {formatTemp(weather.current?.feels_like)}°C</span>
                      <span>H: {formatTemp(weather.daily?.[0]?.temp?.max || weather.daily?.[0]?.temp?.day || weather.current?.temp)}° L: {formatTemp(weather.daily?.[0]?.temp?.min || weather.daily?.[0]?.temp?.night || weather.current?.temp)}°</span>
                    </div>
                  </div>
                  <div className="text-9xl animate-float">
                    {getWeatherEmoji(condition?.id)}
                  </div>
                </div>

                {/* Weather Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/20">
                  {[
                    { icon: <Droplets size={18} />, label: 'Humidity', value: weather.current?.humidity + '%' },
                    { icon: <Wind size={18} />, label: 'Wind Speed', value: Math.round(weather.current?.wind_speed) + ' km/h' },
                    { icon: <Gauge size={18} />, label: 'Pressure', value: (weather.current?.pressure || 'N/A') + ' hPa' },
                    { icon: <Eye size={18} />, label: 'Visibility', value: ((weather.current?.visibility || 0) / 1000).toFixed(1) + ' km' },
                  ].map((s, i) => (
                    <div key={i} className="text-center glass-dark rounded-2xl p-3">
                      <div className="flex justify-center text-white/60 mb-1">{s.icon}</div>
                      <p className="text-white/50 text-xs">{s.label}</p>
                      <p className="text-white font-bold">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Sunrise/Sunset */}
                {weather.current && (
                  <div className="flex justify-center gap-8 mt-4 pt-4 border-t border-white/20">
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <Sunrise size={16} className="text-yellow-300" />
                      <span>Sunrise {formatTime(weather.current.sunrise)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/70 text-sm">
                      <Sunset size={16} className="text-orange-300" />
                      <span>Sunset {formatTime(weather.current.sunset)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 7-day Forecast */}
              {forecastDays && (
                <div className="glass rounded-3xl p-6 mb-6 text-white">
                  <h2 className="font-bold text-white mb-4 text-sm uppercase tracking-wider opacity-70">7-Day Forecast</h2>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {forecastDays.map(([date, item], i) => {
                      const avgTemp = Math.round(item.temp?.day || item.temp || 0);
                      const maxTemp = Math.round(item.temp?.max || item.temp?.day || avgTemp);
                      const minTemp = Math.round(item.temp?.min || item.temp?.night || avgTemp);
                      const mainId = item.weather?.[0]?.id;
                      return (
                        <div key={i} className="flex-shrink-0 glass-dark rounded-2xl p-3 w-24 text-center">
                          <p className="text-white/50 text-xs mb-2">{date.split(',')[0]}</p>
                          <div className="text-3xl mb-2">{getWeatherEmoji(mainId)}</div>
                          <p className="text-white font-bold text-sm">{avgTemp}°</p>
                          <p className="text-white/40 text-xs">{minTemp}° / {maxTemp}°</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Farming Advice */}
              <div className="glass rounded-3xl p-6 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🤖</span>
                  <h2 className="font-bold">AI Farming Advice</h2>
                </div>
                {adviceLoading ? (
                  <div className="flex items-center gap-2 text-white/50">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-sm">Analyzing weather for farming recommendations...</span>
                  </div>
                ) : advice ? (
                  <div className="space-y-3">
                    {advice.advice?.split('\n').filter(Boolean).map((line, i) => (
                      <p key={i} className="text-white/80 text-sm leading-relaxed">{line}</p>
                    ))}
                    {!advice.advice && <p className="text-white/50 text-sm">No specific advice available for current conditions.</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[
                      `🌡️ Current temperature: ${formatTemp(weather.current?.temp)}°C — ${weather.current?.temp > 30 ? 'High heat! Water crops frequently.' : weather.current?.temp < 10 ? 'Cold conditions — protect sensitive crops.' : 'Moderate temperature, good for most crops.'}`,
                      `💧 Humidity at ${weather.current?.humidity}% — ${weather.current?.humidity > 80 ? 'High humidity may cause fungal diseases. Ensure good ventilation.' : weather.current?.humidity < 40 ? 'Low humidity — consider irrigation.' : 'Moderate humidity, suitable for growing.'}`,
                      `💨 Wind speed: ${Math.round(weather.current?.wind_speed)} km/h — ${weather.current?.wind_speed > 40 ? '⚠️ Strong winds! Protect tall crops and greenhouses.' : 'Calm wind, good for spraying pesticides/fertilizers.'}`,
                    ].map((tip, i) => <p key={i} className="text-white/80 text-sm leading-relaxed">{tip}</p>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {!weather && !loading && (
            <div className="text-center py-20">
              <div className="text-8xl mb-4 animate-float">🌤️</div>
              <p className="text-white/70 text-xl font-semibold">Search for a city to see weather</p>
              <p className="text-white/40 text-sm mt-2">AI-powered farming weather insights</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
