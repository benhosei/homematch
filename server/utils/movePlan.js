/**
 * Move Plan Utilities
 *
 * Rule-based generation of moving timelines, checklists, and special item notes.
 */

// Known special items and their handling notes
const SPECIAL_ITEM_NOTES = {
  piano: 'Hire specialty piano movers -- standard movers may refuse or lack proper equipment. Expect $200-$600+ for an upright, $400-$1500+ for a grand piano.',
  'hot tub': 'Hot tub requires professional disconnect (electrical/plumbing), draining, and specialized transport. Budget $300-$1000+ for disconnect and moving.',
  'wine collection': 'Use climate-controlled transport for wine. Pack bottles individually in wine shippers. Avoid moving during extreme heat. Consider insurance for high-value collections.',
  pool_table: 'Pool tables must be disassembled by a specialist and reassembled at destination. Expect $300-$600+ depending on table type.',
  'pool table': 'Pool tables must be disassembled by a specialist and reassembled at destination. Expect $300-$600+ depending on table type.',
  aquarium: 'Drain the aquarium and transport fish separately in bags with original tank water. Move the tank empty. Set up and cycle the tank as soon as possible at your new home.',
  gun_safe: 'Gun safes are extremely heavy (500-2500 lbs). Ensure movers have a heavy-item dolly and sufficient crew. Verify transport laws between states if moving across state lines.',
  'gun safe': 'Gun safes are extremely heavy (500-2500 lbs). Ensure movers have a heavy-item dolly and sufficient crew. Verify transport laws between states if moving across state lines.',
  art: 'Use custom crating for valuable art. Avoid stacking framed pieces. Consider specialty art transport services and additional insurance.',
  antiques: 'Wrap antiques individually in acid-free paper and use custom padding. Photograph each piece beforehand for insurance documentation.',
  motorcycle: 'Use a motorcycle trailer or specialty mover. Drain fluids if shipping long distance. Secure with wheel chocks and tie-down straps.',
  car: 'Arrange auto transport or drive the vehicle separately. Get quotes from enclosed and open carriers. Remove personal items from the vehicle before shipping.',
  boat: 'Hire a licensed boat hauler with proper trailer. Drain water systems and remove electronics. Check height clearance restrictions for your route.',
  treadmill: 'Treadmills are heavy and awkward. Fold if possible, remove safety key, and secure the belt. May require 2-3 people to carry safely.',
  'grandfather clock': 'Remove pendulum and weights before transport. Secure the movement mechanism. Transport upright if possible. Consider specialty clock movers.',
  chandelier: 'Remove and individually wrap each crystal or glass piece. Pack in a sturdy box with ample padding. Reinstallation may require an electrician.',
  plants: 'Most long-distance movers will not transport live plants. Move them yourself in a climate-controlled vehicle. Check destination state plant import regulations.',
  grill: 'Disconnect and remove propane tanks (movers cannot transport them). Clean the grill and secure all loose parts. Transport propane tanks in your own vehicle.',
  trampoline: 'Disassemble the trampoline frame and fold the mat. Label all hardware. Reassembly instructions vary by model -- keep the manual handy.',
  safe: 'Safes are very heavy. Ensure movers have heavy-duty equipment. Some movers charge extra for safes due to weight and liability.',
  appliances: 'Disconnect and defrost refrigerators 24 hours before move. Secure washer drums with transit bolts. Keep appliance manuals for reinstallation.',
};

/**
 * Generate a comprehensive moving plan.
 *
 * @param {string|null} moveDate - ISO date string for the move (defaults to 4 weeks from now)
 * @param {"small"|"medium"|"large"} householdSize
 * @param {boolean} pets - Whether the household has pets
 * @param {string[]} specialItems - List of special items (e.g. ["piano", "hot tub"])
 * @returns {{ timeline: Array, checklist: string[], specialItemNotes: string[] }}
 */
function generateMovePlan(moveDate, householdSize, pets, specialItems) {
  // --- Build Timeline ---
  const timeline = buildTimeline(householdSize, pets, specialItems);

  // --- Build Flat Checklist ---
  const checklist = buildChecklist(householdSize, pets);

  // --- Build Special Item Notes ---
  const specialItemNotes = buildSpecialItemNotes(specialItems);

  return { timeline, checklist, specialItemNotes };
}

/**
 * Build the phased timeline of tasks.
 */
function buildTimeline(householdSize, pets, specialItems) {
  const timeline = [];

  // 8 weeks before
  const eightWeeks = [
    'Research and get quotes from 3+ moving companies',
    'Create a moving budget and track expenses',
    'Start decluttering -- donate, sell, or discard items you no longer need',
    'Begin collecting free boxes and packing supplies',
    'Take inventory of valuable items and photograph them for insurance',
  ];
  if (householdSize === 'large') {
    eightWeeks.push('Research schools and daycare in your new area');
    eightWeeks.push('Request school records transfer for children');
  }
  if (specialItems && specialItems.length > 0) {
    eightWeeks.push('Get specialty moving quotes for items that need special handling (' + specialItems.join(', ') + ')');
  }
  timeline.push({ when: '8 weeks before', tasks: eightWeeks });

  // 6 weeks before
  const sixWeeks = [
    'Book your moving company or reserve a rental truck',
    'Submit a change of address form with USPS',
    'Notify your employer and update payroll address',
    'Start packing non-essential and seasonal items',
    'Arrange for time off work around the move date',
    'Contact insurance companies to transfer or update policies (home, auto, health)',
  ];
  if (householdSize === 'large') {
    sixWeeks.push('Arrange childcare for moving day');
    sixWeeks.push('Notify your children\'s current school of the move');
  }
  if (pets) {
    sixWeeks.push('Research veterinarians in your new area');
    sixWeeks.push('Request pet medical records from your current vet');
  }
  timeline.push({ when: '6 weeks before', tasks: sixWeeks });

  // 4 weeks before
  const fourWeeks = [
    'Notify utility companies of your move (electric, gas, water, internet, trash)',
    'Schedule utility setup at your new home',
    'Update your address with banks, subscriptions, and online accounts',
    'Continue packing room by room -- label all boxes clearly',
    'Arrange for mail forwarding',
    'Start using up pantry items and freezer food to reduce what you move',
  ];
  if (householdSize === 'large') {
    fourWeeks.push('Enroll children in new school and arrange record transfers');
    fourWeeks.push('Plan for moving day meals and snacks for the family');
  }
  if (pets) {
    fourWeeks.push('Update pet ID tags and microchip info with your new address');
    fourWeeks.push('Arrange pet boarding or a pet sitter for moving day if needed');
  }
  timeline.push({ when: '4 weeks before', tasks: fourWeeks });

  // 2 weeks before
  const twoWeeks = [
    'Confirm moving company reservation and review details',
    'Pack most remaining items -- leave only daily essentials',
    'Prepare an essentials box (toiletries, medications, chargers, snacks, change of clothes)',
    'Dispose of hazardous materials that movers cannot transport (paint, propane, chemicals)',
    'Notify friends, family, and important contacts of your new address',
    'Cancel or transfer local memberships (gym, library, clubs)',
    'Clean out storage units, attic, garage, and shed',
  ];
  if (householdSize === 'large') {
    twoWeeks.push('Pack a separate bag for each child with comfort items and entertainment');
  }
  if (pets) {
    twoWeeks.push('Prepare a pet travel kit (food, water, bowl, leash, carrier, medications, comfort toy)');
  }
  timeline.push({ when: '2 weeks before', tasks: twoWeeks });

  // 1 week before
  const oneWeek = [
    'Finish packing all non-essential items',
    'Defrost and clean the refrigerator if you are not taking it',
    'Confirm utility disconnection dates at old home and activation at new home',
    'Back up important computer files and documents',
    'Charge all devices and portable chargers',
    'Plan your travel route and accommodations if it is a long-distance move',
    'Do a final walkthrough of your current home and note any pre-existing damage',
  ];
  if (pets) {
    oneWeek.push('Confirm pet boarding or sitter arrangements for moving day');
  }
  timeline.push({ when: '1 week before', tasks: oneWeek });

  // Moving day
  const movingDay = [
    'Do a final sweep of every room, closet, and cabinet',
    'Supervise movers and ensure all items are loaded',
    'Take meter readings at your old home (electric, gas, water)',
    'Lock all doors and windows and return keys to landlord or realtor',
    'Keep your essentials box, valuables, and important documents with you',
    'Tip movers if service was good (typically $20-$50 per mover)',
  ];
  if (householdSize === 'large') {
    movingDay.push('Assign a family member to keep children occupied and safe');
  }
  if (pets) {
    movingDay.push('Keep pets in a quiet, secure room or at a sitter during loading and unloading');
    movingDay.push('Transport pets in a carrier in your personal vehicle -- never in the moving truck');
  }
  timeline.push({ when: 'Moving day', tasks: movingDay });

  // After the move
  const afterMove = [
    'Inspect delivered items for damage and file claims immediately if needed',
    'Unpack essentials first (beds, bathroom, kitchen basics)',
    'Update your driver\'s license and vehicle registration in your new state',
    'Register to vote at your new address',
    'Meet your new neighbors and explore the neighborhood',
    'Locate the nearest hospital, pharmacy, and grocery store',
    'Schedule a home inspection or walkthrough to note any issues',
    'Set up home security system if applicable',
    'Update your address with the IRS (Form 8822)',
  ];
  if (householdSize === 'large') {
    afterMove.push('Help children settle into their new school and neighborhood');
    afterMove.push('Find a new pediatrician and dentist');
  }
  if (pets) {
    afterMove.push('Set up a safe room for pets to adjust to the new home gradually');
    afterMove.push('Visit your new veterinarian for an introductory checkup');
    afterMove.push('Update pet registration and licenses in your new municipality');
  }
  timeline.push({ when: 'After the move', tasks: afterMove });

  return timeline;
}

/**
 * Build a flat checklist of critical items.
 */
function buildChecklist(householdSize, pets) {
  const checklist = [
    'Get at least 3 moving quotes and compare',
    'Submit USPS change of address',
    'Transfer or cancel utilities',
    'Update address with banks and financial institutions',
    'Forward subscriptions and memberships',
    'Update insurance policies (home, auto, life)',
    'Pack an essentials / first-night box',
    'Label all boxes by room and contents',
    'Photograph valuables for insurance before packing',
    'Back up digital files and important documents',
    'Clean old home thoroughly before handing over keys',
    'Do a final walkthrough of old home',
    'Update driver\'s license and vehicle registration',
    'Register to vote at new address',
    'Update address with IRS',
  ];

  if (householdSize === 'large') {
    checklist.push('Transfer school records for children');
    checklist.push('Find new pediatrician and dentist');
    checklist.push('Enroll children in new school or daycare');
    checklist.push('Update emergency contacts at schools');
  }

  if (pets) {
    checklist.push('Get copies of pet vaccination records');
    checklist.push('Update microchip registration with new address');
    checklist.push('Find a new veterinarian');
    checklist.push('Update pet license in new municipality');
  }

  return checklist;
}

/**
 * Build notes about special items that need extra attention.
 */
function buildSpecialItemNotes(specialItems) {
  if (!specialItems || specialItems.length === 0) {
    return [];
  }

  const notes = [];

  for (const item of specialItems) {
    const key = item.toLowerCase().trim();
    if (SPECIAL_ITEM_NOTES[key]) {
      notes.push(SPECIAL_ITEM_NOTES[key]);
    } else {
      notes.push(
        '"' + item + '" may require special handling. Contact your mover in advance to confirm they can transport it and whether additional fees apply.'
      );
    }
  }

  return notes;
}

module.exports = { generateMovePlan };
