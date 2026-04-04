'use strict';

const PDFDocument = require('pdfkit');

// ─── Brand constants ───────────────────────────────────────────────────────────
const ORANGE   = '#FF6B2B';
const DARK     = '#1A1A1A';
const MID_GREY = '#555555';
const LIGHT_GREY = '#AAAAAA';
const RULE_GREY  = '#DDDDDD';
const WHITE    = '#FFFFFF';
const PAGE_MARGIN = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collect PDFDocument stream chunks into a Buffer.
 * @param {PDFDocument} doc
 * @returns {Promise<Buffer>}
 */
function streamToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

/**
 * Format a date string like "2026-05-15" → "Friday 15 May 2026"
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

/**
 * Format a currency amount in GBP.
 */
function formatCurrency(amount) {
  if (amount == null) return '—';
  return `£${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Draw a full-width horizontal rule.
 */
function drawRule(doc, y, color = RULE_GREY) {
  doc.save()
    .strokeColor(color)
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke()
    .restore();
}

/**
 * Draw the orange accent bar at the top of a page.
 */
function drawHeaderBar(doc, height = 8) {
  doc.save()
    .rect(0, 0, doc.page.width, height)
    .fill(ORANGE)
    .restore();
}

/**
 * Draw the standard page footer.
 */
function drawFooter(doc) {
  const y = doc.page.height - 40;
  drawRule(doc, y - 5);
  doc
    .fontSize(8)
    .fillColor(LIGHT_GREY)
    .font('Helvetica')
    .text(
      'Bash Events — Premium Event & Street Food Catering | info@bashevents.co.uk',
      PAGE_MARGIN,
      y,
      { align: 'center', width: doc.page.width - PAGE_MARGIN * 2 }
    );
}

/**
 * Draw a two-column label / value row and return the new Y position.
 */
function infoRow(doc, label, value, y, labelWidth = 160) {
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  doc
    .font('Helvetica-Bold').fontSize(9).fillColor(MID_GREY)
    .text(label.toUpperCase(), PAGE_MARGIN, y, { width: labelWidth, continued: false });
  doc
    .font('Helvetica').fontSize(9).fillColor(DARK)
    .text(String(value || '—'), PAGE_MARGIN + labelWidth, y, { width: contentWidth - labelWidth });
  return doc.y + 4;
}

/**
 * Draw a cost-table row (label left, value right). Returns new Y.
 */
function costRow(doc, label, value, y, { bold = false, large = false } = {}) {
  const font   = bold ? 'Helvetica-Bold' : 'Helvetica';
  const size   = large ? 11 : 9;
  const color  = bold ? DARK : MID_GREY;
  const right  = doc.page.width - PAGE_MARGIN;
  const width  = doc.page.width - PAGE_MARGIN * 2;

  doc.font(font).fontSize(size).fillColor(color)
    .text(label, PAGE_MARGIN, y, { width: width - 80 });
  doc.font(font).fontSize(size).fillColor(color)
    .text(formatCurrency(value), right - 80, y, { width: 80, align: 'right' });
  return doc.y + (large ? 6 : 3);
}

// ─── Function Sheet ───────────────────────────────────────────────────────────

/**
 * Generate a Function Sheet PDF for the caterer.
 * @param {Object} booking
 * @returns {Promise<Buffer>}
 */
async function generateFunctionSheet(booking) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  const bufferPromise = streamToBuffer(doc);

  const pageWidth  = doc.page.width;
  const contentW   = pageWidth - PAGE_MARGIN * 2;

  // ── Header bar ──
  drawHeaderBar(doc);

  // ── Logo / brand block ──
  doc.y = 30;
  doc
    .font('Helvetica-Bold').fontSize(22).fillColor(ORANGE)
    .text('BASH EVENTS', PAGE_MARGIN, doc.y, { continued: false });

  doc
    .font('Helvetica').fontSize(10).fillColor(MID_GREY)
    .text('Premium Event & Street Food Catering', PAGE_MARGIN, doc.y + 2);

  // Booking ref top-right
  doc
    .font('Helvetica-Bold').fontSize(9).fillColor(DARK)
    .text(booking.bookingRef || 'REF—', pageWidth - PAGE_MARGIN - 140, 34,
      { width: 140, align: 'right' });
  doc
    .font('Helvetica').fontSize(8).fillColor(LIGHT_GREY)
    .text('Booking Reference', pageWidth - PAGE_MARGIN - 140, 46,
      { width: 140, align: 'right' });

  // ── Title band ──
  const titleY = 85;
  doc.save()
    .rect(PAGE_MARGIN, titleY, contentW, 28)
    .fill('#FFF4EE')
    .restore();
  doc
    .font('Helvetica-Bold').fontSize(13).fillColor(ORANGE)
    .text('FUNCTION SHEET', PAGE_MARGIN + 10, titleY + 8);

  doc.y = titleY + 42;

  // ── Section: Event Details ──
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
    .text('EVENT DETAILS', PAGE_MARGIN, doc.y);
  doc.y += 4;
  drawRule(doc, doc.y);
  doc.y += 8;

  let y = doc.y;
  y = infoRow(doc, 'Event Date',   formatDate(booking.eventDate), y);
  y = infoRow(doc, 'Event Type',   booking.eventType, y);
  y = infoRow(doc, 'Location',     booking.location, y);
  y = infoRow(doc, 'Guest Count',  `${booking.guestCount || '—'} guests`, y);
  doc.y = y + 6;

  // ── Section: Client Details ──
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
    .text('CLIENT DETAILS', PAGE_MARGIN, doc.y);
  doc.y += 4;
  drawRule(doc, doc.y);
  doc.y += 8;

  y = doc.y;
  y = infoRow(doc, 'Client Name',  booking.customerName, y);
  y = infoRow(doc, 'Email',        booking.customerEmail, y);
  y = infoRow(doc, 'Phone',        booking.customerPhone, y);
  doc.y = y + 6;

  // ── Section: Menu & Package ──
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
    .text('MENU & PACKAGE', PAGE_MARGIN, doc.y);
  doc.y += 4;
  drawRule(doc, doc.y);
  doc.y += 8;

  y = doc.y;
  y = infoRow(doc, 'Menu',         booking.menuTitle, y);
  y = infoRow(doc, 'Package',      booking.packageName, y);

  // Proteins
  if (booking.selectedProteins && booking.selectedProteins.length) {
    y = infoRow(doc, 'Proteins / Mains', booking.selectedProteins.join(', '), y);
  }

  // Sides
  if (booking.selectedSides && booking.selectedSides.length) {
    y = infoRow(doc, 'Sides', booking.selectedSides.join(', '), y);
  }

  // Menu upsells
  if (booking.menuUpsells && booking.menuUpsells.length) {
    y = infoRow(doc, 'Menu Add-ons', booking.menuUpsells.join(', '), y);
  }

  // Add-ons
  if (booking.addons && booking.addons.length) {
    y = infoRow(doc, 'Extras', booking.addons.join(', '), y);
  }

  // Canapes
  if (booking.selectedCanapes && booking.selectedCanapes.length) {
    y = infoRow(doc, 'Canapes', booking.selectedCanapes.join(', '), y);
  }

  // Dessert
  if (booking.selectedDessert) {
    y = infoRow(doc, 'Dessert', booking.selectedDessert, y);
  }

  // Staff
  if (booking.staffOption) {
    y = infoRow(doc, 'Staffing', booking.staffOption, y);
  }

  doc.y = y + 6;

  // ── Section: Cost Breakdown ──
  doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
    .text('COST BREAKDOWN', PAGE_MARGIN, doc.y);
  doc.y += 4;
  drawRule(doc, doc.y);
  doc.y += 8;

  y = doc.y;

  // Menu + package line
  const menuLine = `${booking.menuTitle || 'Menu'} — ${booking.packageName || ''} Package`;
  y = costRow(doc, menuLine, null, y);

  // Per person rate
  if (booking.packagePrice && booking.guestCount) {
    y = costRow(doc, `  ${formatCurrency(booking.packagePrice)} per person × ${booking.guestCount} guests`,
      booking.packagePrice * booking.guestCount, y);
  }

  // Add-ons line items (itemised if possible, else single line)
  if (booking.addons && booking.addons.length) {
    for (const addon of booking.addons) {
      y = costRow(doc, `  Add-on: ${addon}`, null, y);
    }
  }

  if (booking.menuUpsells && booking.menuUpsells.length) {
    for (const ups of booking.menuUpsells) {
      y = costRow(doc, `  Upsell: ${ups}`, null, y);
    }
  }

  // Thin rule before totals
  y += 4;
  drawRule(doc, y);
  y += 8;

  y = costRow(doc, 'Subtotal',     booking.subtotal,     y);
  y = costRow(doc, `Deposit Paid (20%)`, booking.depositAmount, y);

  y += 4;
  drawRule(doc, y, ORANGE);
  y += 8;

  y = costRow(doc, 'BALANCE DUE', booking.balanceDue, y, { bold: true, large: true });

  doc.y = y + 10;

  // ── Section: Notes ──
  if (booking.notes) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
      .text('NOTES / DIETARY REQUIREMENTS', PAGE_MARGIN, doc.y);
    doc.y += 4;
    drawRule(doc, doc.y);
    doc.y += 8;

    doc.font('Helvetica').fontSize(9).fillColor(DARK)
      .text(booking.notes, PAGE_MARGIN, doc.y, { width: contentW });
    doc.y += 10;
  }

  // ── Booked-at stamp ──
  if (booking.bookedAt) {
    const bookedDate = new Date(booking.bookedAt).toLocaleString('en-GB');
    doc.font('Helvetica').fontSize(8).fillColor(LIGHT_GREY)
      .text(`Booking created: ${bookedDate}`, PAGE_MARGIN, doc.y, { width: contentW });
  }

  // ── Footer on every page ──
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    drawFooter(doc);
  }

  doc.end();
  return bufferPromise;
}

// ─── Kitchen Prep Sheet ───────────────────────────────────────────────────────

/**
 * Generate a Kitchen Prep Sheet PDF for the kitchen team.
 * @param {Object} booking
 * @param {Object} ingredients  - Ingredient database from ./ingredients.js
 * @returns {Promise<Buffer>}
 */
async function generateKitchenPrepSheet(booking, ingredients) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
  const bufferPromise = streamToBuffer(doc);

  const pageWidth = doc.page.width;
  const contentW  = pageWidth - PAGE_MARGIN * 2;

  // ─── PAGE 1 — Event overview ───────────────────────────────────────────────

  drawHeaderBar(doc);
  doc.y = 30;

  // Title + ref
  doc
    .font('Helvetica-Bold').fontSize(18).fillColor(DARK)
    .text('KITCHEN PREP SHEET', PAGE_MARGIN, doc.y);

  doc
    .font('Helvetica').fontSize(9).fillColor(LIGHT_GREY)
    .text(booking.bookingRef || '', PAGE_MARGIN, doc.y + 2);

  // Date block top-right
  doc
    .font('Helvetica-Bold').fontSize(9).fillColor(ORANGE)
    .text(formatDate(booking.eventDate), pageWidth - PAGE_MARGIN - 180, 34,
      { width: 180, align: 'right' });

  doc.y = 78;
  drawRule(doc, doc.y, ORANGE);
  doc.y += 12;

  // ── Guest count — big and bold ──
  doc.save()
    .rect(PAGE_MARGIN, doc.y, contentW, 50)
    .fill('#FFF4EE')
    .restore();

  doc
    .font('Helvetica-Bold').fontSize(32).fillColor(ORANGE)
    .text(String(booking.guestCount || '?'), PAGE_MARGIN + 16, doc.y + 8, { continued: true })
    .font('Helvetica').fontSize(14).fillColor(DARK)
    .text('  GUESTS', { continued: false });

  doc.y += 62;

  // ── Menu & Package ──
  let y = doc.y;
  y = infoRow(doc, 'Menu',     booking.menuTitle, y);
  y = infoRow(doc, 'Package',  booking.packageName, y);
  doc.y = y + 10;

  // ── Proteins ──
  if (booking.selectedProteins && booking.selectedProteins.length) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
      .text('PROTEINS / MAINS', PAGE_MARGIN, doc.y);
    doc.y += 4;
    drawRule(doc, doc.y);
    doc.y += 8;

    for (const protein of booking.selectedProteins) {
      doc.save()
        .circle(PAGE_MARGIN + 5, doc.y + 5, 3)
        .fill(ORANGE)
        .restore();
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(protein, PAGE_MARGIN + 16, doc.y, { width: contentW - 16 });
      doc.y += 4;
    }
    doc.y += 6;
  }

  // ── Sides ──
  if (booking.selectedSides && booking.selectedSides.length) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
      .text('SIDES', PAGE_MARGIN, doc.y);
    doc.y += 4;
    drawRule(doc, doc.y);
    doc.y += 8;

    for (const side of booking.selectedSides) {
      doc.save()
        .circle(PAGE_MARGIN + 5, doc.y + 5, 3)
        .fill(MID_GREY)
        .restore();
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(side, PAGE_MARGIN + 16, doc.y, { width: contentW - 16 });
      doc.y += 4;
    }
    doc.y += 6;
  }

  // ── Add-ons / Canapes / Desserts ──
  const hasCanapes  = booking.selectedCanapes && booking.selectedCanapes.length;
  const hasDessert  = !!booking.selectedDessert;
  const hasUpsells  = booking.menuUpsells && booking.menuUpsells.length;
  const hasAddons   = booking.addons && booking.addons.length;

  if (hasCanapes || hasDessert || hasUpsells || hasAddons) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
      .text('EXTRAS & ADD-ONS', PAGE_MARGIN, doc.y);
    doc.y += 4;
    drawRule(doc, doc.y);
    doc.y += 8;

    if (hasCanapes) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MID_GREY)
        .text('Canapes:', PAGE_MARGIN, doc.y);
      doc.y += 4;
      for (const canape of booking.selectedCanapes) {
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(`• ${canape}`, PAGE_MARGIN + 12, doc.y, { width: contentW - 12 });
        doc.y += 2;
      }
      doc.y += 4;
    }

    if (hasDessert) {
      doc.font('Helvetica-Oblique').fontSize(9).fillColor(MID_GREY)
        .text('Dessert:', PAGE_MARGIN, doc.y);
      doc.y += 4;
      doc.font('Helvetica').fontSize(9).fillColor(DARK)
        .text(`• ${booking.selectedDessert}`, PAGE_MARGIN + 12, doc.y);
      doc.y += 6;
    }

    if (hasUpsells) {
      for (const ups of booking.menuUpsells) {
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(`• ${ups}`, PAGE_MARGIN + 12, doc.y);
        doc.y += 4;
      }
    }

    if (hasAddons) {
      for (const addon of booking.addons) {
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(`• ${addon}`, PAGE_MARGIN + 12, doc.y);
        doc.y += 4;
      }
    }

    doc.y += 4;
  }

  // ── Notes ──
  if (booking.notes) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE)
      .text('KITCHEN NOTES', PAGE_MARGIN, doc.y);
    doc.y += 4;
    drawRule(doc, doc.y);
    doc.y += 8;
    doc.font('Helvetica').fontSize(9).fillColor(DARK)
      .text(booking.notes, PAGE_MARGIN, doc.y, { width: contentW });
    doc.y += 10;
  }

  // ─── PAGE 2 — Shopping / Ingredient List ──────────────────────────────────

  doc.addPage();
  drawHeaderBar(doc);

  doc.y = 30;
  doc
    .font('Helvetica-Bold').fontSize(16).fillColor(DARK)
    .text('SHOPPING LIST', PAGE_MARGIN, doc.y);
  doc
    .font('Helvetica').fontSize(9).fillColor(LIGHT_GREY)
    .text(`${booking.bookingRef || ''} — ${formatDate(booking.eventDate)} — ${booking.guestCount || '?'} guests`,
      PAGE_MARGIN, doc.y + 2);

  doc.y = 78;
  drawRule(doc, doc.y, ORANGE);
  doc.y += 14;

  const menuData  = (ingredients && ingredients[booking.menuKey]) || null;
  const addonsData = (ingredients && ingredients.addons) || null;
  let hasAnyIngredients = false;

  // Helper: render an ingredient block
  function renderIngredientBlock(title, ingredientList) {
    if (!ingredientList || !ingredientList.length) return;
    hasAnyIngredients = true;

    // Check if we need a new page (leave space for at least 60px)
    if (doc.y > doc.page.height - 120) {
      doc.addPage();
      drawHeaderBar(doc);
      doc.y = 30;
    }

    // Section heading
    doc.save()
      .rect(PAGE_MARGIN, doc.y, contentW, 20)
      .fill('#F5F5F5')
      .restore();

    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
      .text(title.toUpperCase(), PAGE_MARGIN + 8, doc.y + 5, { width: contentW - 16 });

    doc.y += 24;

    // Ingredients as comma-separated wrapped text
    const ingredientStr = Array.isArray(ingredientList)
      ? ingredientList.join(', ')
      : String(ingredientList);

    doc.font('Helvetica').fontSize(9).fillColor(MID_GREY)
      .text(ingredientStr, PAGE_MARGIN + 8, doc.y, {
        width: contentW - 16,
        lineGap: 2
      });

    doc.y += 10;
  }

  // ── Proteins ──
  if (booking.selectedProteins && booking.selectedProteins.length) {
    for (const protein of booking.selectedProteins) {
      let ingredientList = null;
      if (menuData && menuData.proteins) {
        // Try exact match first, then case-insensitive
        ingredientList = menuData.proteins[protein]
          || menuData.proteins[protein.toLowerCase()]
          || Object.entries(menuData.proteins).find(
               ([k]) => k.toLowerCase() === protein.toLowerCase()
             )?.[1]
          || null;
      }
      renderIngredientBlock(protein, ingredientList || ['Ingredients not available — check menu database']);
    }
  }

  // ── Sides ──
  if (booking.selectedSides && booking.selectedSides.length) {
    for (const side of booking.selectedSides) {
      let ingredientList = null;
      if (menuData && menuData.sides) {
        ingredientList = menuData.sides[side]
          || menuData.sides[side.toLowerCase()]
          || Object.entries(menuData.sides).find(
               ([k]) => k.toLowerCase() === side.toLowerCase()
             )?.[1]
          || null;
      }
      renderIngredientBlock(side, ingredientList || ['Ingredients not available — check menu database']);
    }
  }

  // ── Canapes ──
  if (booking.selectedCanapes && booking.selectedCanapes.length) {
    const canapesDb = addonsData && addonsData.canapes;
    for (const canape of booking.selectedCanapes) {
      let ingredientList = null;
      if (canapesDb) {
        ingredientList = canapesDb[canape]
          || canapesDb[canape.toLowerCase()]
          || Object.entries(canapesDb).find(
               ([k]) => k.toLowerCase() === canape.toLowerCase()
             )?.[1]
          || null;
      }
      renderIngredientBlock(`Canape: ${canape}`, ingredientList || ['Ingredients not available — check menu database']);
    }
  }

  // ── Dessert ──
  if (booking.selectedDessert) {
    const dessertsDb = addonsData && addonsData.desserts;
    let ingredientList = null;
    if (dessertsDb) {
      ingredientList = dessertsDb[booking.selectedDessert]
        || dessertsDb[booking.selectedDessert.toLowerCase()]
        || Object.entries(dessertsDb).find(
             ([k]) => k.toLowerCase() === booking.selectedDessert.toLowerCase()
           )?.[1]
        || null;
    }
    renderIngredientBlock(`Dessert: ${booking.selectedDessert}`,
      ingredientList || ['Ingredients not available — check menu database']);
  }

  if (!hasAnyIngredients) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(LIGHT_GREY)
      .text('No ingredient data available for this menu selection.', PAGE_MARGIN, doc.y, {
        width: contentW, align: 'center'
      });
  }

  // ── Footer on every page ──
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(pages.start + i);
    drawFooter(doc);
  }

  doc.end();
  return bufferPromise;
}

module.exports = { generateFunctionSheet, generateKitchenPrepSheet };
