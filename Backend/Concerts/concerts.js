const { allMockData } = require('../mockData');

// Helper function to format concert for frontend
const formatConcertForFrontend = (concert) => {
    // Determine status based on concertStatus
    let status = 'available';
    
    if (concert.concertStatus === 'sold_out') {
        status = 'sold-out';
    } else {
        // Make some concerts have active queues for demo (every 3rd concert)
        if (concert.concertID % 3 === 0) {
            status = 'queue-active';
        }
    }
    
    // Format price range
    const minPrice = concert.ticketPrice;
    const maxPrice = (concert.ticketPrice * 2).toFixed(2);
    
    // Calculate available tickets
    let availableTickets = concert.capacity;
    if (concert.concertStatus === 'sold_out') {
        availableTickets = 0;
    } else {
        // Simulate some tickets being sold based on concert ID
        const soldPercentage = (concert.concertID % 40) / 100;
        availableTickets = Math.floor(concert.capacity * (1 - soldPercentage));
        if (availableTickets < 1 && concert.concertStatus !== 'sold_out') {
            availableTickets = 1;
        }
    }
    
    return {
        id: concert.concertID.toString(),
        name: concert.concertName,
        artist: concert.artistName,
        date: concert.date,
        venue: concert.venue,
        image: concert.concertImage,
        price: `$${minPrice} - $${maxPrice}`,
        status: status,
        availableTickets: availableTickets,
        totalTickets: concert.capacity,
        genre: concert.genre
    };
};

const handleGetConcerts = (req, res) => {
    try {
        console.log('Fetching concerts from mock data...');
        console.log(`Total concerts in mock data: ${allMockData.CONCERT.length}`);
        
        // Get all concerts from mock data
        const concerts = allMockData.CONCERT.map(formatConcertForFrontend);
        
        // Sort by date (upcoming first)
        concerts.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        console.log(`Returning ${concerts.length} formatted concerts`);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            concerts: concerts
        }));
    } catch (error) {
        console.error('Error fetching concerts:', error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: 'Failed to fetch concerts',
            error: error.message
        }));
    }
};

const handleGetConcertById = (req, res, concertId) => {
    try {
        const id = parseInt(concertId);
        const concert = allMockData.CONCERT.find(c => c.concertID === id);
        
        if (!concert) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: 'Concert not found'
            }));
            return;
        }
        
        const formattedConcert = formatConcertForFrontend(concert);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            concert: formattedConcert
        }));
    } catch (error) {
        console.error('Error fetching concert:', error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: false,
            message: 'Failed to fetch concert details'
        }));
    }
};

module.exports = {
    handleGetConcerts,
    handleGetConcertById
};