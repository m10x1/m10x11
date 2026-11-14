import {exactMarkerIn,normEmail} from './extract.js';

// Deliberately never selects the newest order; zero or multiple matches mean no delivery.
export function matchingOrders(orders, msg) {
  return orders.filter(o =>
    normEmail(o.AllowedSender)===normEmail(msg.from) && (
      o.MatchMode==='reference'
        ? exactMarkerIn(`${msg.subject}\n${msg.body}`,o.MatchValue)
        : (msg.recipients||[]).map(normEmail).includes(normEmail(o.MatchValue))
    )
  );
}
