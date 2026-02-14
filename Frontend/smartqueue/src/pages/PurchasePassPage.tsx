import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaBolt, FaBullseye, FaClock, FaCheck } from 'react-icons/fa';
import '../styling/PurchasePassPage.css';

interface PassPlan {
  id: string;
  name: string;
  price: number;
  duration: string;
  features: string[];
  recommended?: boolean;
}

const PurchasePassPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const passPlan: PassPlan[] = [
    {
      id: 'silver',
      name: 'Silver Pass',
      price: 9.99,
      duration: 'month',
      features: [
        'Skip the line until 25% venue capacity is filled',
      ],
    },
    {
      id: 'gold',
      name: 'Gold Pass',
      price: 19.99,
      duration: 'month',
      recommended: true,
      features: [
        'Skip the line until 50% venue capacity is filled',
      ],
    }
  ];

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handlePurchase = async () => {
    if (!selectedPlan) return;

    setProcessing(true);

    try {
      // TODO: Replace with actual payment processing API call
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Navigate back to home with success message
      navigate('/home', { 
        state: { 
          message: 'Premium pass purchased successfully! You now have priority access to queues.' 
        }
      });
    } catch (error) {
      console.error('Purchase failed:', error);
      // Handle purchase failure
    } finally {
      setProcessing(false);
    }
  };

  const getSelectedPlan = () => {
    return passPlan.find(plan => plan.id === selectedPlan);
  };

  return (
    <div className="purchase-pass-page">
      <main className="pass-main">
        <section className="hero-section">
          <Link to="/home" className="back-link">← Back to Home</Link>
          <h2>Purchase Premium Passes</h2>
          <p>Skip the line and get priority access to tickets!</p>
        </section>

        <section className="benefits-section">
          <h3>Why Get a Premium Pass?</h3>
          <div className="benefits-grid">
            <div className="benefit-item">
              <div className="benefit-icon"><FaBolt /></div>
              <h4>Skip the Line</h4>
              <p>Jump ahead of regular users until venue capacity thresholds are met!</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon"><FaBullseye /></div>
              <h4>Guaranteed Access</h4>
              <p>Get priority placement in queue based on your pass level!</p>
            </div>
            <div className="benefit-item">
              <div className="benefit-icon"><FaClock /></div>
              <h4>Save Time</h4>
              <p>Spend less time waiting and more time enjoying concerts!</p>
            </div>
          </div>
        </section>

        <section className="plans-section">
          <h3>Choose Your Pass</h3>
          <div className="plans-grid">
            {passPlan.map((plan) => (
              <div 
                key={plan.id} 
                className={`plan-card ${plan.recommended ? 'recommended' : ''} ${selectedPlan === plan.id ? 'selected' : ''}`}
                onClick={() => handleSelectPlan(plan.id)}
              >
                {plan.recommended && (
                  <div className="recommended-badge">Most Popular</div>
                )}
                
                <div className="plan-header">
                  <h4>{plan.name}</h4>
                  <div className="plan-price">
                    <span className="price">${plan.price}</span>
                    <span className="duration">/{plan.duration}</span>
                  </div>
                </div>

                <div className="plan-features">
                  <ul>
                    {plan.features.map((feature, index) => (
                      <li key={index}>
                        <span className="checkmark"><FaCheck /></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <div className="capacity-explanation">
                    <p className="capacity-text">
                      {plan.id === 'silver' 
                        ? 'You\'ll skip the entire line until 25% of tickets are sold, then the pass stops working.'
                        : 'You\'ll skip the entire line until 50% of tickets are sold, then the pass stops working.'
                      }
                    </p>
                  </div>
                </div>

                <button 
                  className={`select-plan-btn ${selectedPlan === plan.id ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPlan(plan.id);
                  }}
                >
                  {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                </button>
              </div>
            ))}
          </div>
          
          <div className="priority-note">
            <p className="note-text">
              <em>Both Silver and Gold Passes hold the same priority level - Gold simply works until 50% venue capacity is reached, while Silver stops at 25% capacity.</em>
            </p>
          </div>
        </section>

        {selectedPlan && (
          <section className="checkout-section">
            <div className="checkout-container">
              <div className="checkout-summary">
                <h3>Order Summary</h3>
                <div className="user-info">
                  <p>Account: {user?.name} ({user?.email})</p>
                </div>
                <div className="selected-plan-info">
                  <h4>{getSelectedPlan()?.name}</h4>
                  <p>{getSelectedPlan()?.duration} access</p>
                  <div className="total-price">
                    <span>Total: ${getSelectedPlan()?.price}</span>
                  </div>
                </div>
              </div>

              <div className="checkout-actions">
                <button 
                  onClick={handlePurchase}
                  disabled={processing}
                  className="purchase-btn"
                >
                  {processing ? 'Processing...' : `Purchase ${getSelectedPlan()?.name}`}
                </button>
                <p className="terms">
                  By purchasing, you agree to our terms and conditions. 
                  Pass benefits apply immediately after purchase.
                </p>
              </div>
            </div>
          </section>
        )}

      </main>
    </div>
  );
};

export default PurchasePassPage;