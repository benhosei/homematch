// Modular market data system - add new cities by creating a new file
import { fishers } from './fishers';
import { carmel } from './carmel';
import { indianapolis } from './indianapolis';
import { austin } from './austin';
import { miami } from './miami';

const MARKETS = {
  fishers,
  carmel,
  indianapolis,
  austin,
  miami
};

export function getMarketData(city) {
  const key = city?.toLowerCase().replace(/\s+/g, '');
  return MARKETS[key] || null;
}

export function getAllMarkets() {
  return Object.values(MARKETS);
}

export function getMarketSummary(city) {
  const m = getMarketData(city);
  if (!m) return null;
  return {
    city: m.city,
    state: m.state,
    medianPrice: m.medianPrice,
    avgDOM: m.avgDaysOnMarket,
    trend: m.trendDirection,
    competition: m.competitionScore
  };
}

export { MARKETS };
