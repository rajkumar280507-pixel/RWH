import { Sun, Cloud, CloudRain, CloudFog, CloudSnow, CloudLightning, HelpCircle } from "lucide-react";

// Maps the weather_service.py WMO icon category to a lucide icon — kept in
// one place so the dashboard card, forecast panel, and insights all agree.
export const WEATHER_ICONS = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  unknown: HelpCircle,
};

export function WeatherIcon({ icon, size = 20, className = "" }) {
  const Icon = WEATHER_ICONS[icon] ?? HelpCircle;
  return <Icon size={size} className={className} />;
}
