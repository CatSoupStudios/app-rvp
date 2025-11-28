import React from "react";
import "./WeatherCard.css";

interface WeatherData {
  city: string;
  temp: number;
  tempMin: number;
  tempMax: number;
  desc: string;
  icon: string;
}

interface WeatherCardProps {
  weather: WeatherData | null;
  loading: boolean;
}

const toF = (c: number) => Math.round(c * 9 / 5 + 32);

const WeatherCard: React.FC<WeatherCardProps> = ({ weather, loading }) => {
  
  // 1. Estado de Carga
  if (loading) {
    return (
      <div className="weather-card-ios weather-bg-day-cloudy" style={{ opacity: 0.8 }}>
        <p style={{marginTop: 20}}>Loading Weather...</p>
      </div>
    );
  }

  // 2. Estado Sin Datos
  if (!weather) {
    return (
      <div className="weather-card-ios weather-bg-day-cloudy">
        <p style={{marginTop: 20}}>Weather Unavailable</p>
      </div>
    );
  }

  // 3. Lógica de Estilo (El cerebro del componente)
  const getBackgroundClass = (iconCode: string, tempCelsius: number) => {
    const isNight = iconCode.includes('n');
    
    // A. LLUVIA (Prioridad visual alta)
    // Códigos 09, 10, 11 son lluvia/tormenta
    if (iconCode.startsWith('09') || iconCode.startsWith('10') || iconCode.startsWith('11')) {
      return 'weather-bg-rain'; 
    }

    // B. NOCHE
    if (isNight) {
      // 01n (Clear), 02n (Few clouds) -> Noche Estrellada
      if (iconCode === '01n' || iconCode === '02n') {
        return 'weather-bg-night-clear';
      }
      // Nubes rotas/nublado -> Noche Nublada (menos estrellas)
      return 'weather-bg-night-cloudy';
    }

    // C. DÍA
    if (iconCode.startsWith('01') || iconCode.startsWith('02')) {
      // ¡LÓGICA DE CALOR! 🔥
      // Si está despejado y hace más de 28°C (82°F), ponemos el fondo Caliente
      if (tempCelsius >= 28) {
        return 'weather-bg-day-hot';
      }
      // Si es fresco, el Azul Apple normal
      return 'weather-bg-day-clear';
    }
    
    // D. DÍA NUBLADO (Por defecto)
    return 'weather-bg-day-cloudy';
  };

  const bgClass = getBackgroundClass(weather.icon, weather.temp);

  return (
    <div className={`weather-card-ios ${bgClass}`}>
      <div className="weather-header">
        📍 {weather.city.toUpperCase()}
      </div>

      <div className="weather-icon-container">
        <img
          src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
          alt={weather.desc}
          className="weather-icon-img"
        />
      </div>

      <div className="weather-temp">
        {toF(weather.temp)}°
      </div>

      <div className="weather-desc">
        {weather.desc}
      </div>

      <div className="weather-hl">
        H:{toF(weather.tempMax)}° &nbsp; L:{toF(weather.tempMin)}°
      </div>
    </div>
  );
};

export default WeatherCard;