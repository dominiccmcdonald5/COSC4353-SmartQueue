const { pool } = require('../database');

// Helper function to format concert for frontend
const formatConcertForFrontend = (concert) => {
    let status = 'available';
    
    if (concert.concert_status === 'sold_out') {
        status = 'sold-out';
    } else if (concert.concert_status === 'open') {
        const concertDate = new Date(concert.event_date);
        const now = new Date();
        const daysUntil = (concertDate - now) / (1000 * 60 * 60 * 24);
        if (daysUntil <= 30 && daysUntil > 0) {
            status = 'queue-active';
        }
    }
    
    const minPrice = concert.ticket_price;
    const maxPrice = (concert.ticket_price * 2).toFixed(2);
    
    return {
        id: concert.concert_id.toString(),
        name: concert.concert_name,
        artist: concert.artist_name,
        date: concert.event_date,
        venue: concert.venue,
        image: concert.concert_image,
        price: `$${minPrice} - $${maxPrice}`,
        status: status,
        availableTickets: concert.availableTickets,
        totalTickets: concert.capacity,
        genre: concert.genre
    };
};

const handleGetConcerts = (req, res) => {
    console.log('Fetching concerts from Azure MySQL...');
    
    // Query using your actual table and column names
    const query = `
        SELECT 
            c.concert_id,
            c.concert_name,
            c.artist_name,
            c.genre,
            c.event_date,
            c.venue,
            c.capacity,
            c.ticket_price,
            c.concert_image,
            c.concert_status,
            COALESCE(SUM(qh.ticket_count), 0) as tickets_sold
        FROM concerts c
        LEFT JOIN queue_history qh ON c.concert_id = qh.concert_id AND qh.status = 'completed'
        GROUP BY c.concert_id
        ORDER BY c.event_date ASC
    `;
    
    pool.query(query, (error, rows) => {
        if (error) {
            console.error('Error fetching concerts:', error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: 'Failed to fetch concerts',
                error: error.message
            }));
            return;
        }
        
        console.log(`Found ${rows.length} concerts in database`);
        
        const concerts = rows.map(concert => {
            const availableTickets = concert.capacity - (concert.tickets_sold || 0);
            return formatConcertForFrontend({
                ...concert,
                availableTickets: availableTickets > 0 ? availableTickets : 0
            });
        });
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            concerts: concerts
        }));
    });
};

const handleGetConcertById = (req, res, concertId) => {
    const id = parseInt(concertId);
    console.log(`Fetching concert with ID: ${id}`);
    
    const query = `
        SELECT 
            c.concert_id,
            c.concert_name,
            c.artist_name,
            c.genre,
            c.event_date,
            c.venue,
            c.capacity,
            c.ticket_price,
            c.concert_image,
            c.concert_status,
            COALESCE(SUM(qh.ticket_count), 0) as tickets_sold
        FROM concerts c
        LEFT JOIN queue_history qh ON c.concert_id = qh.concert_id AND qh.status = 'completed'
        WHERE c.concert_id = ?
        GROUP BY c.concert_id
    `;
    
    pool.query(query, [id], (error, rows) => {
        if (error) {
            console.error('Error fetching concert:', error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: 'Failed to fetch concert details'
            }));
            return;
        }
        
        if (rows.length === 0) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                success: false,
                message: 'Concert not found'
            }));
            return;
        }
        
        const concert = rows[0];
        const availableTickets = concert.capacity - (concert.tickets_sold || 0);
        const formattedConcert = formatConcertForFrontend({
            ...concert,
            availableTickets: availableTickets > 0 ? availableTickets : 0
        });
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
            success: true,
            concert: formattedConcert
        }));
    });
};

module.exports = {
    handleGetConcerts,
    handleGetConcertById
};