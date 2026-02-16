import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
}

const SeatingMapPage: React.FC = () => {
  const { concertId } = useParams<{ concertId: string }>();
  const navigate = useNavigate();
  const [sections, setSections] = useState<SeatingSection[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [concertInfo] = useState({
    name: 'Summer Music Festival',
    artist: 'Various Artists',
    date: '2026-07-15',
    venue: 'Central Park',
  });

  useEffect(() => {
    // TODO: Replace with actual API call
    // Mock seating data
    setTimeout(() => {
      const mockSections: SeatingSection[] = [
        {
          name: 'VIP Section',
          color: '#FFD700',
          seats: Array.from({ length: 20 }, (_, i) => ({
            id: `vip-${i + 1}`,
            section: 'VIP',
            row: String.fromCharCode(65 + Math.floor(i / 5)),
            seatNumber: String((i % 5) + 1),
            price: 200,
            status: Math.random() > 0.7 ? 'taken' : 'available',
          })),
        },
        {
          name: 'Premium Section',
          color: '#C0C0C0',
          seats: Array.from({ length: 50 }, (_, i) => ({
            id: `premium-${i + 1}`,
            section: 'Premium',
            row: String.fromCharCode(65 + Math.floor(i / 10)),
            seatNumber: String((i % 10) + 1),
            price: 150,
            status: Math.random() > 0.6 ? 'taken' : 'available',
          })),
        },
        {
          name: 'General Admission',
          color: '#CD7F32',
          seats: Array.from({ length: 100 }, (_, i) => ({
            id: `general-${i + 1}`,
            section: 'General',
            row: String.fromCharCode(65 + Math.floor(i / 20)),
            seatNumber: String((i % 20) + 1),
            price: 85,
            status: Math.random() > 0.5 ? 'taken' : 'available',
          })),
        },
      ];
      setSections(mockSections);
      setLoading(false);
    }, 1000);
  }, [concertId]);

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

  const handleProceedToPayment = () => {
    if (selectedSeats.length === 0) return;
    
    // Store selected seats in session storage for payment page
    sessionStorage.setItem('selectedSeats', JSON.stringify(selectedSeats));
    navigate(`/payment/${concertId}`);
  };

  if (loading) {
    return (
      <div className="seating-page loading">
        <p>Loading seating map...</p>
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
        <div className="concert-info">
          <h2>{concertInfo.name}</h2>
          <p>{concertInfo.artist} • {concertInfo.venue} • {new Date(concertInfo.date).toLocaleDateString()}</p>
        </div>

        <div className="seating-container">
          <div className="stage">
            <div className="stage-label">STAGE</div>
          </div>

          <div className="seating-map">
            {sections.map((section) => (
              <div key={section.name} className="seating-section">
                <h3 className="section-title" style={{ color: section.color }}>
                  {section.name}
                </h3>
                <div className="seats-grid">
                  {section.seats.map((seat) => (
                    <div
                      key={seat.id}
                      className={`seat ${seat.status}`}
                      onClick={() => handleSeatClick(seat)}
                      title={`${seat.section} ${seat.row}${seat.seatNumber} - $${seat.price}`}
                    >
                      {seat.row}{seat.seatNumber}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="seating-legend">
            <div className="legend-item">
              <div className="seat available"></div>
              <span>Available</span>
            </div>
            <div className="legend-item">
              <div className="seat selected"></div>
              <span>Selected</span>
            </div>
            <div className="legend-item">
              <div className="seat taken"></div>
              <span>Taken</span>
            </div>
            <div className="legend-item">
              <div className="seat reserved"></div>
              <span>Reserved</span>
            </div>
          </div>
        </div>

        <div className="selection-summary">
          <div className="selected-seats">
            <h3>Selected Seats ({selectedSeats.length}/4)</h3>
            {selectedSeats.length === 0 ? (
              <p>No seats selected</p>
            ) : (
              <div className="seats-list">
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="selected-seat">
                    <span>{seat.section} {seat.row}{seat.seatNumber}</span>
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
        </div>
      </main>
    </div>
  );
};

export default SeatingMapPage;