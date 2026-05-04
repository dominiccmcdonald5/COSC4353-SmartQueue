const { pool } = require('../database');

function sendJson(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

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
    
    const minPrice = concert.ticket_price_min != null ? Number(concert.ticket_price_min) : Number(concert.ticket_price);
    const maxPrice = concert.ticket_price_max != null ? Number(concert.ticket_price_max) : Number(concert.ticket_price * 2);
    
    return {
        id: concert.concert_id.toString(),
        name: concert.concert_name,
        artist: concert.artist_name,
        date: concert.event_date,
        venue: concert.venue,
        image: concert.concert_image,
        price: `$${Number(minPrice).toFixed(2)} - $${Number(maxPrice).toFixed(2)}`,
        status: status,
        availableTickets: concert.availableTickets,
        totalTickets: concert.capacity,
        genre: concert.genre
    };
};

const STANDING_CAPACITY_FRACTION = 0.3;
const STANDING_MIN_PRICE = 10;
const STANDING_SECTION = 'Standing';
const STANDING_ROW = 'NOSEAT';

const handleGetConcertTicketing = (req, res, concertId) => {
    const id = parseInt(concertId);
    if (!Number.isInteger(id) || id <= 0) {
        sendJson(res, 400, { success: false, message: 'Invalid concert id' });
        return;
    }

    const runConcertQuery = (sql, params, cb) => pool.query(sql, params, cb);

    const concertQueryWithMin = `
        SELECT concert_id, capacity, ticket_price, ticket_price_min, ticket_price_max
        FROM concerts
        WHERE concert_id = ?
        LIMIT 1
    `;

    const concertQueryFallback = `
        SELECT concert_id, capacity, ticket_price
        FROM concerts
        WHERE concert_id = ?
        LIMIT 1
    `;

    runConcertQuery(concertQueryWithMin, [id], (concertErr, concertRows) => {
        if (concertErr && concertErr.code === 'ER_BAD_FIELD_ERROR') {
            runConcertQuery(concertQueryFallback, [id], (fallbackErr, fallbackRows) => {
                if (fallbackErr) {
                    console.error('Error fetching concert ticketing info:', fallbackErr);
                    sendJson(res, 500, { success: false, message: 'Failed to fetch concert ticketing info' });
                    return;
                }
                // Reuse the same handler shape
                return handleConcertRows(fallbackRows, false);
            });
            return;
        }

        if (concertErr) {
            console.error('Error fetching concert ticketing info:', concertErr);
            sendJson(res, 500, { success: false, message: 'Failed to fetch concert ticketing info' });
            return;
        }

        return handleConcertRows(concertRows, true);
    });

    function handleConcertRows(concertRows, hasMinColumn) {
        if (!Array.isArray(concertRows) || concertRows.length === 0) {
            sendJson(res, 404, { success: false, message: 'Concert not found' });
            return;
        }

        const capacity = Math.max(0, Number(concertRows[0].capacity) || 0);
        const minCandidate =
            hasMinColumn && concertRows[0].ticket_price_min != null
                ? Number(concertRows[0].ticket_price_min)
                : NaN;
        const ticketCandidate = Number(concertRows[0].ticket_price);
        const maxCandidate =
            hasMinColumn && concertRows[0].ticket_price_max != null
                ? Number(concertRows[0].ticket_price_max)
                : NaN;
        const basePrice = Number.isFinite(minCandidate)
            ? minCandidate
            : Number.isFinite(ticketCandidate)
                ? ticketCandidate
                : STANDING_MIN_PRICE;
        const maxPrice = Number.isFinite(maxCandidate)
            ? maxCandidate
            : Number.isFinite(ticketCandidate)
                ? ticketCandidate * 2
                : STANDING_MIN_PRICE;
        const standingCapacity = Math.max(0, Math.floor(capacity * STANDING_CAPACITY_FRACTION));
        const standingPrice = Number.isFinite(basePrice)
            ? Math.max(STANDING_MIN_PRICE, Math.round(basePrice * 100) / 100)
            : 0;

        const soldSeatsQuery = `
            SELECT section, row_label AS rowLabel, seat_number AS seatNumber
            FROM sold_seats
            WHERE concert_id = ?
        `;
        const standingSoldQuery = `
            SELECT COUNT(*) AS sold
            FROM sold_seats
            WHERE concert_id = ?
              AND section = ?
              AND row_label = ?
        `;

        pool.query(soldSeatsQuery, [id], (soldErr, soldRows) => {
            if (soldErr) {
                console.error('Error fetching sold seats:', soldErr);
                sendJson(res, 500, { success: false, message: 'Failed to fetch sold seats' });
                return;
            }
            pool.query(standingSoldQuery, [id, STANDING_SECTION, STANDING_ROW], (standingErr, standingRows) => {
                if (standingErr) {
                    console.error('Error fetching standing sold count:', standingErr);
                    sendJson(res, 500, { success: false, message: 'Failed to fetch standing inventory' });
                    return;
                }

                const standingSold = Math.max(0, Number(standingRows?.[0]?.sold) || 0);
                const standingRemaining = Math.max(0, standingCapacity - standingSold);

                sendJson(res, 200, {
                    success: true,
                    soldSeats: Array.isArray(soldRows) ? soldRows : [],
                    priceRange: { min: basePrice, max: maxPrice },
                    standing: {
                        capacity: standingCapacity,
                        sold: standingSold,
                        remaining: standingRemaining,
                        price: standingPrice,
                    },
                });
            });
        });
    }
};

const handleGetConcerts = (req, res) => {
    console.log('Fetching concerts from Azure MySQL...');
    
    const queryWithRange = `
        SELECT 
            c.concert_id,
            c.concert_name,
            c.artist_name,
            c.genre,
            c.event_date,
            c.venue,
            c.capacity,
            c.ticket_price,
            c.ticket_price_min,
            c.ticket_price_max,
            c.concert_image,
            c.concert_status,
            COALESCE(SUM(qh.ticket_count), 0) as tickets_sold
        FROM concerts c
        LEFT JOIN queue_history qh ON c.concert_id = qh.concert_id AND qh.status = 'completed'
        GROUP BY c.concert_id
        ORDER BY c.event_date ASC
    `;

    const queryFallback = `
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
    
    pool.query(queryWithRange, (error, rows) => {
        if (error && error.code === 'ER_BAD_FIELD_ERROR') {
            pool.query(queryFallback, (fallbackErr, fallbackRows) => {
                if (fallbackErr) {
                    console.error('Error fetching concerts:', fallbackErr);
                    sendJson(res, 500, { success: false, message: 'Failed to fetch concerts', error: fallbackErr.message });
                    return;
                }
                console.log(`Found ${fallbackRows.length} concerts in database`);
                const concerts = (fallbackRows || []).map(concert => {
                    const availableTickets = concert.capacity - (concert.tickets_sold || 0);
                    return formatConcertForFrontend({
                        ...concert,
                        availableTickets: availableTickets > 0 ? availableTickets : 0
                    });
                });
                sendJson(res, 200, { success: true, concerts: concerts });
            });
            return;
        }
        if (error) {
            console.error('Error fetching concerts:', error);
            sendJson(res, 500, { success: false, message: 'Failed to fetch concerts', error: error.message });
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
        
        sendJson(res, 200, { success: true, concerts: concerts });
    });
};

const handleGetConcertById = (req, res, concertId) => {
    const id = parseInt(concertId);
    console.log(`Fetching concert with ID: ${id}`);
    
    const queryWithRange = `
        SELECT 
            c.concert_id,
            c.concert_name,
            c.artist_name,
            c.genre,
            c.event_date,
            c.venue,
            c.capacity,
            c.ticket_price,
            c.ticket_price_min,
            c.ticket_price_max,
            c.concert_image,
            c.concert_status,
            COALESCE(SUM(qh.ticket_count), 0) as tickets_sold
        FROM concerts c
        LEFT JOIN queue_history qh ON c.concert_id = qh.concert_id AND qh.status = 'completed'
        WHERE c.concert_id = ?
        GROUP BY c.concert_id
    `;

    const queryFallback = `
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
    
    pool.query(queryWithRange, [id], (error, rows) => {
        if (error && error.code === 'ER_BAD_FIELD_ERROR') {
            pool.query(queryFallback, [id], (fallbackErr, fallbackRows) => {
                if (fallbackErr) {
                    console.error('Error fetching concert:', fallbackErr);
                    sendJson(res, 500, { success: false, message: 'Failed to fetch concert details' });
                    return;
                }
                if (fallbackRows.length === 0) {
                    sendJson(res, 404, { success: false, message: 'Concert not found' });
                    return;
                }
                const concert = fallbackRows[0];
                const availableTickets = concert.capacity - (concert.tickets_sold || 0);
                const formattedConcert = formatConcertForFrontend({
                    ...concert,
                    availableTickets: availableTickets > 0 ? availableTickets : 0
                });
                sendJson(res, 200, { success: true, concert: formattedConcert });
            });
            return;
        }
        if (error) {
            console.error('Error fetching concert:', error);
            sendJson(res, 500, { success: false, message: 'Failed to fetch concert details' });
            return;
        }
        
        if (rows.length === 0) {
            sendJson(res, 404, { success: false, message: 'Concert not found' });
            return;
        }
        
        const concert = rows[0];
        const availableTickets = concert.capacity - (concert.tickets_sold || 0);
        const formattedConcert = formatConcertForFrontend({
            ...concert,
            availableTickets: availableTickets > 0 ? availableTickets : 0
        });
        
        sendJson(res, 200, { success: true, concert: formattedConcert });
    });
};

module.exports = {
    handleGetConcerts,
    handleGetConcertById,
    handleGetConcertTicketing
};