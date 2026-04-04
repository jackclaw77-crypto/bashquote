# Bash Events Booking System — Design Spec

## Overview
Full booking pipeline: customer selects menu → gets instant quote → pays 20% deposit → system auto-generates Function Sheet + Kitchen Prep Sheet PDFs → emails both to info@bashevents.co.uk and confirmation to customer.

## Architecture

### Frontend (Static HTML)
- `public/index.html` — Existing quote tool, enhanced with "Book & Pay Deposit" button
- `public/success.html` — Post-payment confirmation page with booking ref

### Backend (Vercel Serverless Functions)
- `api/create-checkout.js` — Creates Stripe Checkout session with booking data in metadata
- `api/webhook.js` — Receives Stripe webhook on payment, triggers PDF generation + email

### Libraries
- `lib/ingredients.js` — Complete ingredient database for all 12 menus
- `lib/pdf.js` — PDFKit-based generator for Function Sheet + Kitchen Prep Sheet
- `lib/email.js` — Nodemailer-based email sender (to business + customer)

## Flow
1. Customer builds quote on existing tool (menu, package, proteins, sides, guests, date)
2. Clicks "Book & Pay 20% Deposit"
3. Booking summary shown with editable address + notes fields
4. Clicks "Pay Deposit" → POST to `/api/create-checkout`
5. Redirected to Stripe Checkout (hosted by Stripe)
6. On successful payment → Stripe fires webhook to `/api/webhook`
7. Webhook parses booking data from session metadata
8. Generates Function Sheet PDF (event details, cost breakdown)
9. Generates Kitchen Prep Sheet PDF (selected items + full ingredient lists)
10. Emails both PDFs to info@bashevents.co.uk
11. Emails Function Sheet to customer as confirmation
12. Customer redirected to `/success.html` with booking ref

## Pricing Logic
- 20% deposit on booking, balance due 7 days before event
- Existing sliding scale pricing preserved (80+ guests = base rate, scales up for smaller groups)
- Min spend: £600 weekday, £1000 weekend

## PDF Content

### Function Sheet
- Booking reference, event date, client details
- Guest count, event type, location
- Full cost breakdown (menu, supplements, add-ons)
- Deposit paid vs balance due
- Special notes/dietary requirements

### Kitchen Prep Sheet  
- Menu and package selected
- Guest count (prominent)
- All selected proteins/mains with full ingredient lists
- All selected sides with full ingredient lists
- Canape and dessert ingredients if applicable

## Deployment
- Vercel free tier (static + serverless)
- Environment variables for Stripe + email credentials
- No cost until transactions happen (Stripe 1.4% + 20p per payment)

## Required Setup (Adrian)
1. Create Stripe account at stripe.com (free)
2. Get API keys from Stripe dashboard
3. Set up Gmail app password for info@bashevents.co.uk
4. Add environment variables to Vercel
