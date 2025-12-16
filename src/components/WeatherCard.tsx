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
  
  // 1. Skeleton Loading (Más elegante que texto plano)
  if (loading) {
    return (
      <div className="wc-card wc-loading">
        <div className="wc-skeleton-line title"></div>
        <div className="wc-skeleton-row">
           <div className="wc-skeleton-circle"></div>
           <div className="wc-skeleton-line big"></div>
        </div>
      </div>
    );
  }

  // 2. Estado Sin Datos
  if (!weather) {
    return (
      <div className="wc-card wc-error">
        <span>Weather Unavailable</span>
      </div>
    );
  }

  // 3. Tu Lógica de Fondos (INTACTA)
  const getBackgroundClass = (iconCode: string, tempCelsius: number) => {
    const isNight = iconCode.includes('n');
    
    // A. LLUVIA
    if (iconCode.startsWith('09') || iconCode.startsWith('10') || iconCode.startsWith('11')) {
      return 'wc-rain'; 
    }

    // B. NOCHE
    if (isNight) {
      if (iconCode === '01n' || iconCode === '02n') return 'wc-night-clear';
      return 'wc-night-cloudy';
    }

    // C. DÍA
    if (iconCode.startsWith('01') || iconCode.startsWith('02')) {
      if (tempCelsius >= 28) return 'wc-day-hot'; // Calor
      return 'wc-day-clear'; // Fresco
    }
    
    // D. DÍA NUBLADO
    return 'wc-day-cloudy';
  };

  const bgClass = getBackgroundClass(weather.icon, weather.temp);

  return (
    <div className={`wc-card ${bgClass}`}>
      
      {/* CAPA DE EFECTOS (Estrellas/Gotas según CSS) */}
      <div className="wc-bg-effect"></div>

      {/* CONTENIDO PRINCIPAL (Layout Horizontal) */}
      <div className="wc-content">
        
        {/* IZQUIERDA: Textos */}
        <div className="wc-info-col">
          <div className="wc-city">
            <span className="wc-loc-icon">📍</span> {weather.city}
          </div>
          <div className="wc-temp-wrapper">
             <span className="wc-temp-main">{toF(weather.temp)}°</span>
          </div>
          <div className="wc-desc">
            {weather.desc}
            <span className="wc-hl">H:{toF(weather.tempMax)}° L:{toF(weather.tempMin)}°</span>
          </div>
        </div>

        {/* DERECHA: Icono Flotante Grande */}
        <div className="wc-icon-col">
          <img
            src={`https://openweathermap.org/img/wn/${weather.icon}@4x.png`}
            alt={weather.desc}
            className="wc-icon-img"
          />
        </div>

      </div>
    </div>
  );
};

export default WeatherCard;