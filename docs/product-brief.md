# Product brief

## Who it is for

A fraud analyst on a retail bank's operations floor, watching live transaction flow and
deciding, in seconds, whether to let a payment through.

## The job

Today the analyst sees a queue of alerts with a score and a rule ID. Everything else —
who the payee is, whether the device is new, what the customer's normal Tuesday looks
like — is in another screen. By the time they have the picture, the money has moved.

SENTINEL AI gives them the picture and the score together, and holds the payment while
they look.

## Four surfaces

1. **Live flow** — transactions streaming in, scored, colour-coded by risk band.
2. **Case view** — one flagged transaction, its contributing signals, and the
   Gemini-written narrative explaining why it scored the way it did.
3. **Intervention** — the hold/release decision, plus the customer verification step that
   fires automatically on a rapid-drain breach.
4. **Entity graph** — accounts, devices and payees connected to this case, so a mule
   network shows up as a shape rather than a list.

## Success for the prototype

- A synthetic transaction stream scored end to end in under 500 ms per transaction.
- A rapid-drain scenario that triggers a hold without an analyst touching it.
- An explanation an analyst would actually read, grounded in the signals rather than
  invented.
- A connected-entity view that makes a mule ring visible in one screen.

## Explicitly out of scope

Model training, real bank integration, production auth, and anything requiring real
customer data.
