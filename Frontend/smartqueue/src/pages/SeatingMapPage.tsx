import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatLocalDateFromApi } from '../utils/apiDate';
import '../styling/SeatingMapPage.css';

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Deterministic shuffle so the same concert id keeps the same seat pattern.
function buildAvailabilityMask(totalSeats: number, availableSeats: number, seedInput: string): Set<number> {
  const seats = Array.from({ length: totalSeats }, (_, i) => i);
  let seed = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
  }

  for (let i = seats.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const t = seats[i];
    seats[i] = seats[j];
    seats[j] = t;
  }

  return new Set(seats.slice(0, clamp(availableSeats, 0, totalSeats)));
}

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
  const [loading, setLoading] = useState(true);
  const [concertLoading, setConcertLoading] = useState(true);
  const [hoveredSeat, setHoveredSeat] = useState<Seat | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const [concertInfo, setConcertInfo] = useState<ConcertInfo | null>(null);

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
        const response = await fetch(`/api/concerts/${concertId}`);
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

    setLoading(true);
    // Single block — 11 rows (A–K), 12 seats per side (24 per row), center walkway
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
    const seatsPerSide = 12;
    const totalRenderedSeats = rows.length * seatsPerSide * 2;

    let targetAvailable = Math.round(totalRenderedSeats * 0.5);
    if (
      concertInfo &&
      Number.isFinite(concertInfo.availableTickets) &&
      Number.isFinite(concertInfo.totalTickets) &&
      (concertInfo.totalTickets as number) > 0
    ) {
      const ratio = (concertInfo.availableTickets as number) / (concertInfo.totalTickets as number);
      targetAvailable = Math.round(totalRenderedSeats * clamp(ratio, 0, 1));
    }

    const availableMask = buildAvailabilityMask(totalRenderedSeats, targetAvailable, String(concertId));
    let seatIndex = 0;
    const mainSeats: Seat[] = [];

    rows.forEach((row, ri) => {
      for (let s = 1; s <= seatsPerSide * 2; s++) {
        mainSeats.push({
          id: `main-${concertId}-${row}-${s}`,
          section: 'Orchestra',
          row,
          seatNumber: String(s),
          price: 100 - ri * 6,
          status: availableMask.has(seatIndex) ? 'available' : 'taken',
        });
        seatIndex += 1;
      }
    });

    setSections([{ name: 'Orchestra', seats: mainSeats, color: '#64748b', subsection: 'center' }]);
    setLoading(false);
  }, [concertId, concertInfo?.availableTickets, concertInfo?.totalTickets]);

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
      if (selectedSeats.length < 4) {
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
    return selectedSeats.reduce((total, seat) => total + seat.price, 0);
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
    if (selectedSeats.length === 0) return;
    
    // Store selected seats in session storage for payment page
    sessionStorage.setItem('selectedSeats', JSON.stringify(selectedSeats));
    navigate(`/payment/${concertId}`);
  };

  if (loading || concertLoading) {
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
            <h3>Selected Seats ({selectedSeats.length}/4)</h3>
            {selectedSeats.length === 0 ? (
              <p>No seats selected</p>
            ) : (
              <div className="seats-list">
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="selected-seat">
                    <span>Seat {seat.row}{seat.seatNumber}</span>
                    <span>${seat.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="total-price">
            <h3>Total: ${getTotalPrice()}</h3>
          </div>

          <div className="seating-actions">
            <button 
              onClick={handleProceedToPayment}
              disabled={selectedSeats.length === 0}
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