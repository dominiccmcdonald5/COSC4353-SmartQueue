import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatLocalDateFromApi } from '../utils/apiDate';
import { seatPriceForRowIndex } from '../utils/seatingPriceBand';
import '../styling/SeatingMapPage.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://cosc4353-smartqueue.onrender.com').replace(/\/$/, '');

interface Seat {
  id: string;
  section: string;
  row: string;
  seatNumber: string;
  price: number;
  status: 'available' | 'selected' | 'taken' | 'reserved';
}

interface SeatingSection {
  name: string;
  seats: Seat[];
  color: string;
  /** For Main/Side/Rear: 'left' | 'center' | 'right' | 'behind'. Omit for single-block sections. */
  subsection?: 'left' | 'center' | 'right' | 'behind';
}

interface ConcertInfo {
  name: string;
  artist: string;
  date: string;
  venue: string;
  availableTickets: number | null;
  totalTickets: number | null;
}

interface ApiConcertResponse {
  success: boolean;
  concert?: {
    name?: string;
    artist?: string;
    date?: string;
    venue?: string;
    availableTickets?: number;
    totalTickets?: number;
  };
  message?: string;
}

interface TicketingResponse {
  success: boolean;
  soldSeats?: Array<{
    section?: string;
    rowLabel?: string;
    /** legacy backend shape */
    row?: string;
    seatNumber?: string;
    /** legacy backend shape */
    seat_number?: string;
  }>;
  priceRange?: { min?: number; max?: number };
  standing?: { capacity?: number; sold?: number; remaining?: number; price?: number };
  message?: string;
}

const STANDING_MIN_PRICE = 10;

function groupSeatsByRow(seats: Seat[]): Record<string, Seat[]> {
  const byRow: Record<string, Seat[]> = {};
  seats.forEach((seat) => {
    if (!byRow[seat.row]) byRow[seat.row] = [];
    byRow[seat.row].push(seat);
  });
  Object.keys(byRow).forEach((row) => byRow[row].sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber)));
  return byRow;
}

const SeatingMapPage: React.FC = () => {
  const { concertId } = useParams<{ concertId: string }>();
  const navigate = useNavigate();
  const [sections, setSections] = useState<SeatingSection[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [standingQty, setStandingQty] = useState(0);
  const [standingRemaining, setStandingRemaining] = useState<number | null>(null);
  const [standingPrice, setStandingPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [concertLoading, setConcertLoading] = useState(true);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [concertInfo, setConcertInfo] = useState<ConcertInfo | null>(null);
  const [ticketingLoading, setTicketingLoading] = useState(true);
  const [soldSeatIds, setSoldSeatIds] = useState<Set<string>>(new Set());
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);

  useEffect(() => {
    if (!concertId) {
      setConcertInfo(null);
      setConcertLoading(false);
      return;
    }

    let mounted = true;
    const fetchConcertInfo = async () => {
      setConcertLoading(true);
      try {
        const response = await fetch(`${API_BASE}/api/concerts/${concertId}`);
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setConcertInfo(null);
          return;
        }

        const payload = (await response.json()) as ApiConcertResponse;

        if (!mounted) return;

        if (!response.ok || !payload.success || !payload.concert) {
          setConcertInfo(null);
          return;
        }

        setConcertInfo({
          name: payload.concert.name || `Concert ${concertId}`,
          artist: payload.concert.artist || '',
          date: payload.concert.date || '',
          venue: payload.concert.venue || '',
          availableTickets: Number.isFinite(Number(payload.concert.availableTickets))
            ? Number(payload.concert.availableTickets)
            : null,
          totalTickets: Number.isFinite(Number(payload.concert.totalTickets))
            ? Number(payload.concert.totalTickets)
            : null,
        });
      } catch {
        if (!mounted) return;
        setConcertInfo(null);
      } finally {
        if (mounted) setConcertLoading(false);
      }
    };

    fetchConcertInfo();
    return () => {
      mounted = false;
    };
  }, [concertId]);
  const concertNotFound = concertId && concertInfo === null;

  useEffect(() => {
    if (!concertId) return;
    let mounted = true;
    setTicketingLoading(true);
    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/concerts/${concertId}/ticketing`);
        const payload = (await res.json()) as TicketingResponse;
        if (!mounted) return;
        if (!res.ok || !payload.success) {
          setSoldSeatIds(new Set());
          setStandingRemaining(null);
          setStandingPrice(null);
          setPriceMin(null);
          setPriceMax(null);
          return;
        }
        const sold = new Set<string>();
        (payload.soldSeats || []).forEach((s) => {
          const section = String(s.section || 'Orchestra').trim();
          const row = String(s.rowLabel ?? s.row ?? '').trim();
          const seatNumber = String(s.seatNumber ?? s.seat_number ?? '').trim();
          if (!row || !seatNumber) return;
          sold.add(`${section}||${row}||${seatNumber}`.toLowerCase());
        });
        setSoldSeatIds(sold);
        const remaining = payload.standing?.remaining;
        const price = payload.standing?.price;
        setStandingRemaining(Number.isFinite(Number(remaining)) ? Number(remaining) : null);
        setStandingPrice(Number.isFinite(Number(price)) ? Number(price) : null);
        const min = payload.priceRange?.min;
        const max = payload.priceRange?.max;
        setPriceMin(Number.isFinite(Number(min)) ? Number(min) : null);
        setPriceMax(Number.isFinite(Number(max)) ? Number(max) : null);
        setStandingQty((prev) => {
          const max = Number.isFinite(Number(remaining)) ? Math.max(0, Number(remaining)) : prev;
          return Math.min(prev, 4, max);
        });
      } catch {
        if (!mounted) return;
        setSoldSeatIds(new Set());
        setStandingRemaining(null);
        setStandingPrice(null);
        setPriceMin(null);
        setPriceMax(null);
      } finally {
        if (mounted) setTicketingLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [concertId]);

  useEffect(() => {
    if (!concertId) return;

    setLoading(true);
    // Single block — 11 rows (A–K), 12 seats per side (24 per row), center walkway
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const seatsPerSide = 12;
    const mainSeats: Seat[] = [];

    rows.forEach((row, ri) => {
      for (let s = 1; s <= seatsPerSide * 2; s++) {
        const section = 'Orchestra';
        const soldKey = `${section}||${row}||${s}`.toLowerCase();
        const statusFromInventory = soldSeatIds.has(soldKey) ? 'taken' : null;
        const min = priceMin ?? 50;
        const max = priceMax ?? Math.max(min, 100);
        const seatPrice = seatPriceForRowIndex(ri, rows.length, min, max);
        mainSeats.push({
          id: `main-${concertId}-${row}-${s}`,
          section,
          row,
          seatNumber: String(s),
          price: seatPrice,
          status: statusFromInventory || 'available',
        });
      }
    });

    setSections([{ name: 'Orchestra', seats: mainSeats, color: '#64748b', subsection: 'center' }]);
    setLoading(false);
  }, [concertId, soldSeatIds, priceMin, priceMax]);

  const renderedTotalSeats = sections.reduce((sum, section) => sum + section.seats.length, 0);
  const renderedAvailableSeats = sections.reduce(
    (sum, section) => sum + section.seats.filter((seat) => seat.status === 'available' || seat.status === 'selected').length,
    0,
  );

  const handleSeatClick = (seat: Seat) => {
    if (seat.status === 'taken' || seat.status === 'reserved') return;

    if (seat.status === 'selected') {
      // Deselect seat
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
      setSections(prev => prev.map(section => ({
        ...section,
        seats: section.seats.map(s => 
          s.id === seat.id ? { ...s, status: 'available' } : s
        ),
      })));
    } else {
      // Select seat (limit to 4 seats)
      if (selectedSeats.length + standingQty < 4) {
        setSelectedSeats(prev => [...prev, seat]);
        setSections(prev => prev.map(section => ({
          ...section,
          seats: section.seats.map(s => 
            s.id === seat.id ? { ...s, status: 'selected' } : s
          ),
        })));
      }
    }
  };

  const getTotalPrice = () => {
    const seatsTotal = selectedSeats.reduce((total, seat) => total + seat.price, 0);
    const effectiveStandingPrice =
      standingPrice != null
        ? standingPrice
        : priceMin != null
          ? Math.max(STANDING_MIN_PRICE, priceMin)
          : null;
    const standTotal = effectiveStandingPrice != null ? standingQty * effectiveStandingPrice : 0;
    return seatsTotal + standTotal;
  };

  const handleSeatMouseEnter = (seat: Seat, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredSeat(seat);
    setPopupPos({ x: rect.left + rect.width / 2, y: rect.top });
  };

  const handleSeatMouseLeave = () => {
    setHoveredSeat(null);
    setPopupPos(null);
  };

  const handleProceedToPayment = () => {
    if (selectedSeats.length + standingQty === 0) return;
    
    // Store selected seats in session storage for payment page
    sessionStorage.setItem('selectedSeats', JSON.stringify(selectedSeats));
    sessionStorage.setItem('standingQty', String(standingQty));
    const effectiveStandingPrice =
      standingPrice != null
        ? standingPrice
        : priceMin != null
          ? Math.max(STANDING_MIN_PRICE, priceMin)
          : null;
    if (effectiveStandingPrice != null) sessionStorage.setItem('standingPrice', String(effectiveStandingPrice));
    navigate(`/payment/${concertId}`);
  };

  if (loading || concertLoading || ticketingLoading) {
    return (
      <div className="seating-page loading">
        <p>Loading seating map...</p>
      </div>
    );
  }

  if (!concertId) {
    return (
      <div className="seating-page">
        <header className="seating-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Select Your Seats</h1>
        </header>
        <main className="seating-main">
          <p className="concert-info">No concert selected.</p>
        </main>
      </div>
    );
  }

  if (concertNotFound) {
    return (
      <div className="seating-page">
        <header className="seating-header">
          <Link to="/" className="back-link">← Back to Home</Link>
          <h1>Select Your Seats</h1>
        </header>
        <main className="seating-main">
          <p className="concert-info">Concert not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="seating-page">
      <header className="seating-header">
        <Link to={`/queue/${concertId}`} className="back-link">← Back to Queue</Link>
        <h1>Select Your Seats</h1>
      </header>

      <main className="seating-main">
        {concertInfo && (
          <div className="concert-info">
            <h2>{concertInfo.name}</h2>
            <p>{concertInfo.artist} • {concertInfo.venue} • {formatLocalDateFromApi(concertInfo.date)}</p>
            <p>
              Seats Available:{' '}
              {concertInfo.availableTickets != null && concertInfo.totalTickets != null
                ? `${concertInfo.availableTickets.toLocaleString()} of ${concertInfo.totalTickets.toLocaleString()}`
                : `${renderedAvailableSeats.toLocaleString()} of ${renderedTotalSeats.toLocaleString()}`}
            </p>
          </div>
        )}

        <div className="seating-layout">
        <div className="seating-container auditorium-view">
          <div className="auditorium-stage">
            <div className="proscenium-left" />
            <div className="stage-content">
              <div className="stage-curtain" />
              <div className="stage-apron">
                <div className="footlights" />
                <span className="stage-label">STAGE</span>
              </div>
            </div>
            <div className="proscenium-right" />
          </div>

          {hoveredSeat && popupPos && (
            <div
              className="seat-popup"
              style={{
                left: popupPos.x,
                top: popupPos.y,
              }}
              role="tooltip"
            >
              <span className="seat-popup-row">Row {hoveredSeat.row}</span>
              <span className="seat-popup-seat">Seat {hoveredSeat.seatNumber}</span>
              <span className="seat-popup-price">${hoveredSeat.price}</span>
            </div>
          )}
          <div className="seating-map-wrap">
            <div className="seating-map-spacer" aria-hidden />
            <div className="seating-map venue-chart">
            {/* Front block + block behind — center walkway in each row */}
            {sections
              .filter((s) => s.name === 'Orchestra')
              .map((section) => (
                <div key={section.name} className="venue-section" data-section={section.name}>
                  <div className="venue-rows">
                    {(() => {
                      const byRow = groupSeatsByRow(section.seats);
                      const rowOrder = Object.keys(byRow).sort((a, b) => (a < b ? -1 : 1));
                      return rowOrder.map((row) => {
                        const rowSeats = byRow[row];
                        const mid = Math.floor(rowSeats.length / 2);
                        const leftSeats = rowSeats.slice(0, mid);
                        const rightSeats = rowSeats.slice(mid);
                        return (
                          <div key={row} className="seat-row straight-row row-with-aisle">
                            <span className="row-label">{row}</span>
                            <div className="seat-group">
                              {leftSeats.map((seat) => (
                                <div
                                  key={seat.id}
                                  className={`seat ${seat.status}`}
                                  onClick={() => handleSeatClick(seat)}
                                  onMouseEnter={(e) => handleSeatMouseEnter(seat, e)}
                                  onMouseLeave={handleSeatMouseLeave}
                                >
                                  {seat.seatNumber}
                                </div>
                              ))}
                            </div>
                            <div className="aisle" aria-label="Walkway" />
                            <div className="seat-group">
                              {rightSeats.map((seat) => (
                                <div
                                  key={seat.id}
                                  className={`seat ${seat.status}`}
                                  onClick={() => handleSeatClick(seat)}
                                  onMouseEnter={(e) => handleSeatMouseEnter(seat, e)}
                                  onMouseLeave={handleSeatMouseLeave}
                                >
                                  {seat.seatNumber}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}

            {/* Side — left & right */}
            {sections.filter((s) => s.name === 'Side').length > 0 && (
              <div className="venue-section side-row">
                <div className="subsection-row">
                  {['left', 'right'].map((sub) => {
                    const section = sections.find((s) => s.name === 'Side' && s.subsection === sub);
                    if (!section) return null;
                    const byRow = groupSeatsByRow(section.seats);
                    const rowOrder = Object.keys(byRow).sort((a, b) => (a < b ? -1 : 1));
                    return (
                      <div key={`loge-${sub}`} className="subsection-block">
                        <div className="venue-rows">
                          {rowOrder.map((row) => {
                            const rowSeats = byRow[row];
                            return (
                              <div key={row} className="seat-row straight-row">
                                <span className="row-label">{row}</span>
                                {rowSeats.map((seat) => (
                                  <div
                                    key={seat.id}
                                    className={`seat ${seat.status}`}
                                    onClick={() => handleSeatClick(seat)}
                                    onMouseEnter={(e) => handleSeatMouseEnter(seat, e)}
                                    onMouseLeave={handleSeatMouseLeave}
                                  >
                                    {seat.seatNumber}
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rear — back */}
            {sections
              .filter((s) => s.name === 'Rear')
              .map((section) => (
                <div key={section.name} className="venue-section" data-section={section.name}>
                  <div className="venue-rows">
                    {(() => {
                      const byRow = groupSeatsByRow(section.seats);
                      const rowOrder = Object.keys(byRow).sort((a, b) => (a < b ? -1 : 1));
                      return rowOrder.map((row) => {
                        const rowSeats = byRow[row];
                        return (
                          <div key={row} className="seat-row straight-row">
                            <span className="row-label">{row}</span>
                            {rowSeats.map((seat) => (
                              <div
                                key={seat.id}
                                className={`seat ${seat.status}`}
                                onClick={() => handleSeatClick(seat)}
                                onMouseEnter={(e) => handleSeatMouseEnter(seat, e)}
                                onMouseLeave={handleSeatMouseLeave}
                              >
                                {seat.seatNumber}
                              </div>
                            ))}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ))}
          </div>
            <div className="seating-map-spacer" aria-hidden />
          </div>

          <div className="seating-legend">
            <div className="legend-availability">
              <div className="legend-item">
                <div className="seat available" />
                <span>Available</span>
              </div>
              <div className="legend-item">
                <div className="seat selected" />
                <span>Selected</span>
              </div>
              <div className="legend-item">
                <div className="seat taken" />
                <span>Taken</span>
              </div>
              <div className="legend-item">
                <div className="seat reserved" />
                <span>Reserved</span>
              </div>
            </div>
          </div>
        </div>

        <aside className="selection-summary">
          <div className="selected-seats">
            <h3>Selected Tickets ({selectedSeats.length + standingQty}/4)</h3>
            {selectedSeats.length + standingQty === 0 ? <p>No tickets selected</p> : null}
            {selectedSeats.length > 0 ? (
              <div className="seats-list">
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="selected-seat">
                    <span>Seat {seat.row}{seat.seatNumber}</span>
                    <span>${seat.price}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="standing-picker">
              <div className="standing-picker-row">
                <span className="standing-label">
                  Standing (no seat)
                  {standingRemaining != null ? ` • ${standingRemaining} left` : ''}
                </span>
                <span className="standing-price">
                  {(() => {
                    const effectiveStandingPrice =
                      standingPrice != null
                        ? standingPrice
                        : priceMin != null
                          ? Math.max(STANDING_MIN_PRICE, priceMin)
                          : null;
                    return effectiveStandingPrice != null ? `$${effectiveStandingPrice.toFixed(2)}` : 'Loading…';
                  })()}
                </span>
              </div>
              <div className="standing-controls">
                <button
                  type="button"
                  className="standing-btn"
                  onClick={() => setStandingQty((q) => Math.max(0, q - 1))}
                  disabled={standingQty <= 0}
                >
                  −
                </button>
                <span className="standing-qty" aria-label="Standing ticket quantity">{standingQty}</span>
                <button
                  type="button"
                  className="standing-btn"
                  onClick={() =>
                    setStandingQty((q) => {
                      const maxByLimit = 4 - selectedSeats.length;
                      const maxByInv = standingRemaining != null ? standingRemaining : 4;
                      return Math.min(q + 1, maxByLimit, maxByInv);
                    })
                  }
                  disabled={
                    standingRemaining === 0 ||
                    standingQty >= (standingRemaining != null ? standingRemaining : 4) ||
                    selectedSeats.length + standingQty >= 4
                  }
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="total-price">
            <h3>Total: ${getTotalPrice()}</h3>
          </div>

          <div className="seating-actions">
            <button 
              onClick={handleProceedToPayment}
              disabled={selectedSeats.length + standingQty === 0}
              className="proceed-payment-btn"
            >
              Proceed to Payment
            </button>
          </div>
        </aside>
        </div>
      </main>
    </div>
  );
};

export default SeatingMapPage;