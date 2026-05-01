# Backend Function Guide (AdminDataReport -> UserManagement)

This document explains what each backend function does for files in:
- AdminDataReport
- AdminQueue
- ConcertManagement
- Concerts
- Login
- PassPurchase
- ServiceManagement
- SignUp
- UserDashboard
- UserManagement

## 1. AdminDataReport
### File: [Backend/AdminDataReport/dataReportStats.js](Backend/AdminDataReport/dataReportStats.js)
- getDataReportStats(req, res)
  - Reads mock data from mockDataStore.json.
  - Computes report metrics for admin dashboard:
    - total users
    - total events
    - total revenue (completed history only)
    - average queue time
    - top genres
    - pass distribution
    - monthly revenue trend
    - user growth by month (cumulative)
  - Returns JSON report payload or a 500 error.

## 2. AdminQueue
### File: [Backend/AdminQueue/queue.js](Backend/AdminQueue/queue.js)
- sendJson(res, statusCode, payload)
  - Helper to send JSON responses with status code.

- getQueue(req, res)
  - Returns current in-memory admin support queue with position and metadata.

- serveNext(req, res)
  - Removes and returns the first queue entry from in-memory queue.
  - If empty, returns success with no served entry.

- getQueueStatusByConcert(req, res, rawConcertId, userIdQuery)
  - Computes queue status for a specific concert based on HISTORY records.
  - Returns queue size, user position, estimated wait time, and flags like isInQueue.

- readJsonBody(req)
  - Helper Promise that collects and parses JSON request body.

- joinQueue(req, res)
  - Primary behavior: adds a user to a concert queue in HISTORY.
  - Validates user/concert IDs and prevents active queue conflicts.
  - Returns created queue entry with computed position/wait estimate.
  - Fallback behavior: can add generic in-memory support queue entry.

- leaveQueue(req, res)
  - Marks the user's active queue entry for a concert as cancelled/left.

- completePayment(req, res)
  - Marks queued entry as completed/entered and updates ticketCount/totalCost/waitTime.
  - If no active queued row exists, creates a completed HISTORY record.

## 3. ConcertManagement
### File: [Backend/ConcertManagement/concerts.js](Backend/ConcertManagement/concerts.js)
- sendJson(res, statusCode, payload)
  - Helper to send JSON responses.

- readJsonBody(req)
  - Helper to parse request JSON body.

- getAllConcerts(req, res)
  - Returns all concerts from mock store sorted by concertID.

- validateEditPayload(payload)
  - Validates partial concert edit payload fields and value constraints.

- createConcert(req, res)
  - Validates required concert creation fields.
  - Creates a new concert with next concertID and default/open status.
  - Persists to mockDataStore.json.

- editConcert(req, res, rawId)
  - Validates concert ID and edit payload.
  - Applies partial updates to allowed fields.
  - Persists to mockDataStore.json.

- deleteConcert(req, res, rawId)
  - Deletes concert by ID and removes related HISTORY rows.
  - Persists changes.

## 4. Concerts (User-facing listing)
### File: [Backend/Concerts/concerts.js](Backend/Concerts/concerts.js)
- formatConcertForFrontend(concert)
  - Transforms raw concert record to frontend shape.
  - Computes display status, price range string, and available ticket simulation.

- handleGetConcerts(req, res)
  - Returns all concerts formatted for frontend.
  - Sorts by date ascending.

- handleGetConcertById(req, res, concertId)
  - Returns one formatted concert by ID.
  - Responds 404 if not found.

## 5. Login
### File: [Backend/Login/login.js](Backend/Login/login.js)
- handleLogin(req, res)
  - Reads JSON body and validates credentials.
  - Checks USER records first, then ADMIN records.
  - Returns account metadata for user/admin on success.
  - Returns 404 for no match, 500 for errors.

## 6. PassPurchase
### File: [Backend/PassPurchase/updatePass.js](Backend/PassPurchase/updatePass.js)
- updateUserPassStatus(req, res)
  - Reads userID and passStatus from request body.
  - Normalizes pass status to Gold/Silver/None.
  - Validates input and user existence.
  - Updates user passStatus and persists.

## 7. ServiceManagement
### File: [Backend/ServiceManagement/services.js](Backend/ServiceManagement/services.js)
- sendJson(res, statusCode, payload)
  - JSON response helper.

- readJsonBody(req)
  - JSON body parser helper.

- validateCreatePayload(payload)
  - Validates required fields and constraints for new service.

- validateUpdatePayload(payload)
  - Validates partial update payload for existing service.

- listServices(req, res)
  - Returns in-memory list of services.

- createService(req, res)
  - Validates payload and creates service with timestamps and next ID.

- updateService(req, res, serviceID)
  - Validates service ID and payload, applies partial updates, refreshes updatedAt.

## 8. SignUp
### File: [Backend/SignUp/signup.js](Backend/SignUp/signup.js)
- handleSignup(req, res)
  - Parses signup payload.
  - Validates required fields and checks duplicate email.
  - Creates new user with default passStatus None and createdAt timestamp.
  - Persists to mockDataStore.json.

## 9. UserDashboard - Concert History
### File: [Backend/UserDashboard/ConcertHistory/userHistory.js](Backend/UserDashboard/ConcertHistory/userHistory.js)
- getConcertHistory(req, res)
  - Validates userID.
  - Fetches all HISTORY records for that user.
  - Joins each history record with its CONCERT details.
  - Returns combined concert + history response.

## 10. UserDashboard - User Stats
### File: [Backend/UserDashboard/UserStats/userStats.js](Backend/UserDashboard/UserStats/userStats.js)
- getUserStats(req, res)
  - Validates userID.
  - Computes user-level metrics from HISTORY and CONCERT:
    - total queues
    - successful queues
    - top 3 genres
    - total spending
    - spending breakdown by concert
  - Returns aggregated stats payload.

## 11. UserManagement
### File: [Backend/UserManagement/adminUsers.js](Backend/UserManagement/adminUsers.js)
- sendJson(res, statusCode, payload)
  - JSON response helper.

- readJsonBody(req)
  - JSON body parser helper.

- totalSpentFromHistory(userID)
  - Computes fallback totalSpent from HISTORY records for a user.

- derivePassType(row)
  - Derives normalized passType (none/silver/gold) from user row.

- passTierToStorePassStatus(tier)
  - Maps normalized pass type to stored passStatus format (None/Silver/Gold).

- rowToAdminShape(row)
  - Converts raw USER row into admin-facing UI shape.

- splitName(nameStr)
  - Splits full name string into firstName and lastName.

- getAllUsers(req, res)
  - Returns all users in admin-shaped format sorted by userID.

- validateEditPayload(payload, options)
  - Validates user create/edit payload fields and constraints.

- emailTaken(email, excludeUserID)
  - Checks if an email is already used by another user.

- createUser(req, res)
  - Validates and creates a new user with generated password fallback.
  - Persists to mockDataStore.json.

- editUser(req, res, rawId)
  - Validates user ID and payload, applies partial updates, persists.

- deleteUser(req, res, rawId)
  - Deletes user by ID and removes related HISTORY records.
  - Persists changes.
