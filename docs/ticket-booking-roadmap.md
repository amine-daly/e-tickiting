# Ticket Booking Roadmap

## 1. Entities Involved

- **TripType**: Represents a bus trip (source, destination, date, price, availableSeats, seats, etc.)
- **UserType**: The customer booking the ticket
- **TicketType**: Represents a booking (user, trip, seat, status, payment info, etc.)

## 2. Booking Flow

### A. Search & Select Trip

1. Customer searches for trips (by source, destination, date)
2. Frontend displays available trips (`GET /api/trips`)
3. Customer selects a trip to book

### B. Choose Seat(s)

4. Customer sees available seats for the selected trip
5. Customer selects one or more seats

### C. Book Ticket

6. Customer clicks "Book" or "Reserve"
7. Frontend sends a POST request to `/api/tickets` with:
   ```json
   {
     "tripId": "TRIP_ID",
     "userId": "USER_ID",
     "seatNumbers": [1, 2],
     "paymentInfo": {}
   }
   ```

### D. Backend Processing

8. Backend checks:
   - Are the seats still available?
   - Is the user eligible?
   - (Optional) Is payment valid?
9. If all checks pass:
   - Creates a new `TicketType` document
   - Marks the selected seats as reserved/booked in the `TripType`
   - Decrements `availableSeats` in the `TripType`
10. Returns the ticket info (and payment status if applicable)

### E. Confirmation

11. Frontend shows booking confirmation (ticket number, trip details, seat, etc.)
12. (Optional) Sends email/SMS confirmation to the user

## 3. Concurrency & Consistency

- Backend must ensure two users cannot book the same seat at the same time (use transactions or atomic updates)
- Always check seat availability on the backend

## 4. Ticket Status

- Possible statuses: `BOOKED`, `PAID`, `CANCELLED`, `EXPIRED`, etc.
- Status changes as user pays, cancels, or the trip departs

## 5. Cancellation/Refund

- User can cancel a ticket (if allowed by policy)
- Backend updates ticket status and frees up the seat

## 6. Admin/Manager View

- Admins/managers can view all tickets for a trip, see occupancy, and manage bookings

## 7. API Endpoints Summary

| Step          | Action               | API Endpoint                         |
| ------------- | -------------------- | ------------------------------------ |
| Search Trips  | List available trips | `GET /api/trips`                     |
| Book Ticket   | Create ticket        | `POST /api/tickets`                  |
| View Ticket   | Get ticket details   | `GET /api/tickets/:id`               |
| Cancel Ticket | Cancel ticket        | `DELETE /api/tickets/:id` or `PATCH` |
