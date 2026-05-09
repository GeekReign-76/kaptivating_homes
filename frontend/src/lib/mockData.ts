/**
 * mockData.ts
 *
 * Realistic test fixtures for all API entities.
 * Used when TEST_MODE is active — components receive the same
 * shape as real API responses so the UI renders identically.
 */

// -------------------------------------------------------------------------
// Listings
// -------------------------------------------------------------------------

export const MOCK_LISTINGS = [
  {
    id: 'lst-001',
    source: 'mls',
    mls_id: 'SC2024001',
    address: '214 Broad St',
    city: 'Charleston',
    state: 'SC',
    zip: '29401',
    price: 485000,
    beds: 3,
    baths: 2,
    sqft: 1820,
    property_type: 'Residential',
    status: 'Active',
    description: 'Stunning historic Charleston single home steps from the French Quarter. Original heart-pine floors, updated kitchen with quartz countertops, and a private courtyard garden. Walk to restaurants, galleries, and the harbor.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', order: 0 },
      { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', order: 1 },
      { url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', order: 2 },
    ],
    listed_at: '2024-05-01T10:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-002',
    source: 'manual',
    address: '8821 Waterway Dr',
    city: 'Mount Pleasant',
    state: 'SC',
    zip: '29466',
    price: 749000,
    beds: 4,
    baths: 3,
    sqft: 2950,
    property_type: 'Residential',
    status: 'Active',
    description: 'Waterfront property on Shem Creek with a private dock. Open-concept living, chef\'s kitchen, primary suite with panoramic marsh views. Truly one of a kind.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800', order: 0 },
      { url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800', order: 1 },
    ],
    listed_at: '2024-04-15T09:00:00Z',
    is_starred: true,
  },
  {
    id: 'lst-003',
    source: 'mls',
    mls_id: 'SC2024003',
    address: '5 Palmetto Blvd',
    city: 'Isle of Palms',
    state: 'SC',
    zip: '29451',
    price: 1250000,
    beds: 5,
    baths: 4,
    sqft: 3800,
    property_type: 'Residential',
    status: 'Active',
    description: 'Oceanfront luxury retreat on the Isle of Palms. Completely renovated with designer finishes, elevator, rooftop deck with direct ocean views, and private pool.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', order: 0 },
      { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', order: 1 },
    ],
    listed_at: '2024-05-10T11:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-004',
    source: 'mls',
    mls_id: 'SC2024004',
    address: '312 Oak St',
    city: 'Summerville',
    state: 'SC',
    zip: '29483',
    price: 295000,
    beds: 3,
    baths: 2,
    sqft: 1540,
    property_type: 'Residential',
    status: 'Active',
    description: 'Move-in ready cottage in the heart of Summerville. Updated bathrooms, new HVAC, large fenced backyard perfect for entertaining.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', order: 0 },
    ],
    listed_at: '2024-05-20T08:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-005',
    source: 'mls',
    mls_id: 'GA2024001',
    address: '2201 Peachtree Rd NW',
    city: 'Atlanta',
    state: 'GA',
    zip: '30309',
    price: 625000,
    beds: 4,
    baths: 3,
    sqft: 2600,
    property_type: 'Residential',
    status: 'Active',
    description: 'Elegant Buckhead townhome with rooftop terrace. Minutes from top dining, shopping, and schools. Two-car garage, smart home features throughout.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800', order: 0 },
      { url: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800', order: 1 },
    ],
    listed_at: '2024-05-05T10:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-006',
    source: 'mls',
    mls_id: 'GA2024002',
    address: '450 Savannah Hwy',
    city: 'Savannah',
    state: 'GA',
    zip: '31401',
    price: 389000,
    beds: 3,
    baths: 2,
    sqft: 2100,
    property_type: 'Residential',
    status: 'Active',
    description: 'Charming Victorian cottage in the historic district. Original millwork, soaring ceilings, wraparound porch, and a short walk to Forsyth Park.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1575517111839-3a3843ee7f5d?w=800', order: 0 },
    ],
    listed_at: '2024-04-28T09:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-007',
    source: 'mls',
    mls_id: 'FL2024001',
    address: '1842 Ocean Drive',
    city: 'Miami Beach',
    state: 'FL',
    zip: '33139',
    price: 1875000,
    beds: 3,
    baths: 3,
    sqft: 2200,
    property_type: 'Condo',
    status: 'Active',
    description: 'Iconic Art Deco building with breathtaking ocean views. Floor-to-ceiling windows, resort-style amenities, private beach access, and valet parking.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800', order: 0 },
      { url: 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800', order: 1 },
    ],
    listed_at: '2024-05-12T13:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-008',
    source: 'mls',
    mls_id: 'FL2024002',
    address: '700 Gulf Shore Blvd',
    city: 'Naples',
    state: 'FL',
    zip: '34102',
    price: 2450000,
    beds: 4,
    baths: 4,
    sqft: 4100,
    property_type: 'Residential',
    status: 'Active',
    description: 'Gulf-front estate with private pool and boat dock. Completely renovated, impact-resistant windows, whole-home generator, and lush tropical landscaping.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1613490493576-4a9e02c46756?w=800', order: 0 },
    ],
    listed_at: '2024-05-08T10:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-009',
    source: 'mls',
    mls_id: 'SC2024005',
    address: '99 Hibiscus Lane',
    city: 'Hilton Head Island',
    state: 'SC',
    zip: '29928',
    price: 558000,
    beds: 3,
    baths: 2,
    sqft: 1900,
    property_type: 'Residential',
    status: 'Pending',
    description: 'Updated villa in a gated Sea Pines community. Access to championship golf, tennis, and miles of pristine beach. Short-term rental history available.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800', order: 0 },
    ],
    listed_at: '2024-04-01T08:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-010',
    source: 'manual',
    address: '3300 Sunset Blvd',
    city: 'Columbia',
    state: 'SC',
    zip: '29201',
    price: 219000,
    beds: 2,
    baths: 1,
    sqft: 1100,
    property_type: 'Residential',
    status: 'Active',
    description: 'Cozy starter home near the university district. Recently painted, new appliances, private backyard with mature shade trees.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800', order: 0 },
    ],
    listed_at: '2024-05-22T11:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-011',
    source: 'mls',
    mls_id: 'GA2024003',
    address: '11 Cotton Exchange Way',
    city: 'Augusta',
    state: 'GA',
    zip: '30901',
    price: 175000,
    beds: 3,
    baths: 2,
    sqft: 1450,
    property_type: 'Residential',
    status: 'Active',
    description: 'Renovated craftsman bungalow near downtown Augusta. Refinished hardwoods, updated kitchen, covered front porch, and detached garage.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', order: 0 },
    ],
    listed_at: '2024-05-18T09:00:00Z',
    is_starred: false,
  },
  {
    id: 'lst-012',
    source: 'mls',
    mls_id: 'FL2024003',
    address: '401 Harbour Way',
    city: 'St. Petersburg',
    state: 'FL',
    zip: '33701',
    price: 465000,
    beds: 3,
    baths: 2,
    sqft: 1750,
    property_type: 'Residential',
    status: 'Active',
    description: 'Renovated craftsman in the coveted Old Northeast neighborhood. Walkable to vibrant downtown St. Pete, museums, and waterfront parks.',
    photos: [
      { url: 'https://images.unsplash.com/photo-1590725121839-892b458a74fe?w=800', order: 0 },
    ],
    listed_at: '2024-05-25T10:00:00Z',
    is_starred: false,
  },
];

// -------------------------------------------------------------------------
// Threads + Messages
// -------------------------------------------------------------------------

export const MOCK_THREADS = [
  {
    id: 'thr-001',
    client_id: 'usr-002',
    subject: 'Re: 214 Broad St, Charleston, SC',
    last_message_at: '2024-05-28T14:32:00Z',
    agent_unread_count: 1,
    client_unread_count: 0,
    client: { id: 'usr-002', full_name: 'Sarah Johnson', email: 'sarah@example.com', avatar_url: null },
    last_message: { content: 'Would Friday at 10am work for a showing?', message_type: 'text', sender_role: 'client', sent_at: '2024-05-28T14:32:00Z' },
  },
  {
    id: 'thr-002',
    client_id: 'usr-003',
    subject: 'Re: 8821 Waterway Dr, Mount Pleasant, SC',
    last_message_at: '2024-05-27T09:15:00Z',
    agent_unread_count: 0,
    client_unread_count: 2,
    client: { id: 'usr-003', full_name: 'Marcus Williams', email: 'marcus@example.com', avatar_url: null },
    last_message: { content: "I've attached the latest market analysis for this area.", message_type: 'text', sender_role: 'agent', sent_at: '2024-05-27T09:15:00Z' },
  },
  {
    id: 'thr-003',
    client_id: 'usr-004',
    subject: 'Looking for 3BR in Charleston under $500k',
    last_message_at: '2024-05-26T16:00:00Z',
    agent_unread_count: 0,
    client_unread_count: 0,
    client: { id: 'usr-004', full_name: 'Emily Chen', email: 'emily@example.com', avatar_url: null },
    last_message: { content: 'Thanks for sending those! I love the Broad St property.', message_type: 'text', sender_role: 'client', sent_at: '2024-05-26T16:00:00Z' },
  },
];

export const MOCK_MESSAGES: Record<string, any[]> = {
  'thr-001': [
    { id: 'msg-001', thread_id: 'thr-001', sender_id: 'usr-002', sender_role: 'client', message_type: 'text', content: 'Hi! I saw the listing on 214 Broad St and I\'m very interested. Is it still available?', sent_at: '2024-05-25T10:00:00Z', read_at: '2024-05-25T10:05:00Z', metadata: {} },
    { id: 'msg-002', thread_id: 'thr-001', sender_id: null, sender_role: 'agent', message_type: 'text', content: 'Hi Sarah! Yes, it\'s still available. It\'s a beautiful historic home in the heart of the French Quarter. Would you like to schedule a showing?', sent_at: '2024-05-25T10:30:00Z', read_at: '2024-05-25T11:00:00Z', metadata: {} },
    { id: 'msg-003', thread_id: 'thr-001', sender_id: 'usr-002', sender_role: 'client', message_type: 'text', content: 'That sounds wonderful! What days are available this week?', sent_at: '2024-05-26T09:00:00Z', read_at: '2024-05-26T09:15:00Z', metadata: {} },
    { id: 'msg-004', thread_id: 'thr-001', sender_id: null, sender_role: 'agent', message_type: 'property_card', content: null, sent_at: '2024-05-26T09:20:00Z', read_at: '2024-05-26T10:00:00Z', metadata: { listing_id: 'lst-001', address: '214 Broad St', city: 'Charleston', state: 'SC', price: 485000, beds: 3, baths: 2, photo_url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', listing_url: '/listings/lst-001' } },
    { id: 'msg-005', thread_id: 'thr-001', sender_id: 'usr-002', sender_role: 'client', message_type: 'text', content: 'Would Friday at 10am work for a showing?', sent_at: '2024-05-28T14:32:00Z', read_at: null, metadata: {} },
  ],
  'thr-002': [
    { id: 'msg-010', thread_id: 'thr-002', sender_id: 'usr-003', sender_role: 'client', message_type: 'text', content: 'I saw your listing on Waterway Dr — is the dock private or shared?', sent_at: '2024-05-26T08:00:00Z', read_at: '2024-05-26T08:30:00Z', metadata: {} },
    { id: 'msg-011', thread_id: 'thr-002', sender_id: null, sender_role: 'agent', message_type: 'text', content: "It's a fully private dock with a 30-foot boat slip. The property sits on about 0.4 acres of waterfront. I've attached the latest market analysis for this area.", sent_at: '2024-05-27T09:15:00Z', read_at: null, metadata: {} },
  ],
  'thr-003': [
    { id: 'msg-020', thread_id: 'thr-003', sender_id: 'usr-004', sender_role: 'client', message_type: 'text', content: "Hi! I'm relocating to Charleston from Chicago and looking for a 3BR under $500k. Do you have anything available?", sent_at: '2024-05-24T14:00:00Z', read_at: '2024-05-24T14:30:00Z', metadata: {} },
    { id: 'msg-021', thread_id: 'thr-003', sender_id: null, sender_role: 'agent', message_type: 'text', content: "Welcome! Charleston is a wonderful choice. I have a few great options that match your criteria. Let me share them:", sent_at: '2024-05-25T09:00:00Z', read_at: '2024-05-25T09:30:00Z', metadata: {} },
    { id: 'msg-022', thread_id: 'thr-003', sender_id: null, sender_role: 'agent', message_type: 'property_card', content: null, sent_at: '2024-05-25T09:01:00Z', read_at: '2024-05-25T09:30:00Z', metadata: { listing_id: 'lst-001', address: '214 Broad St', city: 'Charleston', state: 'SC', price: 485000, beds: 3, baths: 2, photo_url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800', listing_url: '/listings/lst-001' } },
    { id: 'msg-023', thread_id: 'thr-003', sender_id: null, sender_role: 'agent', message_type: 'property_card', content: null, sent_at: '2024-05-25T09:02:00Z', read_at: '2024-05-25T09:30:00Z', metadata: { listing_id: 'lst-004', address: '312 Oak St', city: 'Summerville', state: 'SC', price: 295000, beds: 3, baths: 2, photo_url: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', listing_url: '/listings/lst-004' } },
    { id: 'msg-024', thread_id: 'thr-003', sender_id: 'usr-004', sender_role: 'client', message_type: 'text', content: 'Thanks for sending those! I love the Broad St property.', sent_at: '2024-05-26T16:00:00Z', read_at: '2024-05-26T16:30:00Z', metadata: {} },
  ],
};

// -------------------------------------------------------------------------
// Appointments
// -------------------------------------------------------------------------

export const MOCK_APPOINTMENTS = [
  {
    id: 'apt-001',
    client_id: 'usr-002',
    appointment_type: 'property_showing',
    status: 'pending',
    requested_start: '2024-05-31T10:00:00Z',
    requested_end:   '2024-05-31T10:45:00Z',
    confirmed_start: null,
    confirmed_end:   null,
    notes: '214 Broad St showing',
    listing_id: 'lst-001',
    cancel_reason: null,
    created_at: '2024-05-28T14:45:00Z',
    client: { full_name: 'Sarah Johnson', email: 'sarah@example.com', phone: '(843) 555-0102' },
  },
  {
    id: 'apt-002',
    client_id: 'usr-003',
    appointment_type: 'buyer_consultation',
    status: 'confirmed',
    requested_start: '2024-06-03T14:00:00Z',
    requested_end:   '2024-06-03T15:00:00Z',
    confirmed_start: '2024-06-03T14:00:00Z',
    confirmed_end:   '2024-06-03T15:00:00Z',
    notes: 'Initial buyer consultation — waterfront properties focus',
    listing_id: null,
    cancel_reason: null,
    created_at: '2024-05-27T10:00:00Z',
    client: { full_name: 'Marcus Williams', email: 'marcus@example.com', phone: '(843) 555-0103' },
  },
  {
    id: 'apt-003',
    client_id: 'usr-004',
    appointment_type: 'property_showing',
    status: 'counter_proposed',
    requested_start: '2024-06-01T09:00:00Z',
    requested_end:   '2024-06-01T09:45:00Z',
    confirmed_start: '2024-06-01T11:00:00Z',
    confirmed_end:   '2024-06-01T11:45:00Z',
    notes: 'Showing 214 Broad St + 312 Oak St back to back',
    listing_id: 'lst-001',
    cancel_reason: null,
    created_at: '2024-05-26T16:30:00Z',
    client: { full_name: 'Emily Chen', email: 'emily@example.com', phone: '(843) 555-0104' },
  },
];

export const MOCK_APPOINTMENT_TYPES = [
  { id: 'buyer_consultation', name: 'Buyer Consultation', duration_minutes: 60, buffer_minutes: 15, description: 'Discuss your needs, budget, and timeline with me one-on-one.' },
  { id: 'property_showing',   name: 'Property Showing',   duration_minutes: 45, buffer_minutes: 15, description: 'Tour a specific property.' },
  { id: 'offer_review',       name: 'Offer Review',       duration_minutes: 30, buffer_minutes: 10, description: 'Review and discuss a purchase offer.' },
];

// Available slots for next 7 days starting June 1
export const MOCK_SLOTS = [
  { start: '2024-06-01T09:00:00Z', end: '2024-06-01T09:45:00Z' },
  { start: '2024-06-01T11:00:00Z', end: '2024-06-01T11:45:00Z' },
  { start: '2024-06-01T14:00:00Z', end: '2024-06-01T14:45:00Z' },
  { start: '2024-06-03T09:00:00Z', end: '2024-06-03T09:45:00Z' },
  { start: '2024-06-03T10:00:00Z', end: '2024-06-03T10:45:00Z' },
  { start: '2024-06-04T13:00:00Z', end: '2024-06-04T13:45:00Z' },
  { start: '2024-06-04T15:00:00Z', end: '2024-06-04T15:45:00Z' },
  { start: '2024-06-05T09:00:00Z', end: '2024-06-05T09:45:00Z' },
];

// -------------------------------------------------------------------------
// Blog Posts
// -------------------------------------------------------------------------

export const MOCK_BLOG_POSTS = [
  {
    id: 'blg-001',
    title: "Charleston's Hottest Neighborhoods in 2024",
    slug: 'charlestons-hottest-neighborhoods-2024',
    excerpt: 'From the cobblestone streets of the French Quarter to the waterfront charm of Mount Pleasant, here are the neighborhoods every buyer should know.',
    cover_image_url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200',
    tags: ['market-update', 'charleston', 'neighborhoods'],
    status: 'published',
    published_at: '2024-05-15T12:00:00Z',
    read_time_minutes: 5,
    content_html: `
      <p>Charleston's real estate market continues to attract buyers from across the country, and for good reason. The city's blend of history, culture, and coastal lifestyle is unmatched on the East Coast.</p>
      <h2>The French Quarter</h2>
      <p>The historic French Quarter remains one of the most sought-after areas in all of South Carolina. Properties here rarely stay on the market more than 30 days, and prices have increased 12% year-over-year.</p>
      <h2>Mount Pleasant</h2>
      <p>Just across the Cooper River from downtown, Mount Pleasant offers waterfront living with easy access to the city. The Shem Creek area is especially popular with buyers looking for dock access.</p>
      <h2>Isle of Palms</h2>
      <p>For those dreaming of oceanfront living, Isle of Palms delivers. From modest beach cottages to multi-million dollar estates, there is something for every buyer at every price point.</p>
    `,
  },
  {
    id: 'blg-002',
    title: "First-Time Homebuyer's Guide to the SC Lowcountry",
    slug: 'first-time-homebuyer-guide-sc-lowcountry',
    excerpt: "Everything you need to know before making your first real estate purchase in the South Carolina Lowcountry — from financing to closing day.",
    cover_image_url: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200',
    tags: ['first-time-buyers', 'guide', 'south-carolina'],
    status: 'published',
    published_at: '2024-04-20T09:00:00Z',
    read_time_minutes: 8,
    content_html: `
      <p>Buying your first home is one of the biggest decisions you'll ever make. In the Lowcountry, there are a few unique factors to consider that can make the process smoother.</p>
      <h2>Get Pre-Approved First</h2>
      <p>In the current market, most sellers won't even consider an offer without a pre-approval letter. Work with a local lender who understands the Charleston market.</p>
      <h2>Understand Flood Zones</h2>
      <p>Much of the Lowcountry falls within FEMA flood zones. Make sure you understand the flood insurance requirements for any property you're considering — it can significantly impact your monthly payment.</p>
      <h2>Working with an Agent</h2>
      <p>As your agent, I work exclusively in your interest throughout the process — from identifying the right neighborhoods to negotiating the best possible price.</p>
    `,
  },
];

// -------------------------------------------------------------------------
// Leads
// -------------------------------------------------------------------------

export const MOCK_LEADS = [
  {
    id: 'led-001',
    user_id: 'usr-002',
    source: 'contact_form',
    status: 'hot',
    notes: 'Very motivated buyer. Pre-approved for $550k. Wants to close by end of June.',
    tags: ['pre-approved', 'motivated', 'june-close'],
    created_at: '2024-05-25T10:00:00Z',
    user: { id: 'usr-002', full_name: 'Sarah Johnson', email: 'sarah@example.com', phone: '(843) 555-0102', avatar_url: null, created_at: '2024-05-25T10:00:00Z' },
  },
  {
    id: 'led-002',
    user_id: 'usr-003',
    source: 'contact_form',
    status: 'warm',
    notes: 'Waterfront buyer. Flexible on timeline. Has a property to sell first.',
    tags: ['waterfront', 'contingent'],
    created_at: '2024-05-26T08:00:00Z',
    user: { id: 'usr-003', full_name: 'Marcus Williams', email: 'marcus@example.com', phone: '(843) 555-0103', avatar_url: null, created_at: '2024-05-26T08:00:00Z' },
  },
  {
    id: 'led-003',
    user_id: 'usr-004',
    source: 'chat',
    status: 'warm',
    notes: 'Relocating from Chicago. Needs help understanding the market. Good candidate for buyer consultation.',
    tags: ['relocation', 'chicago'],
    created_at: '2024-05-24T14:00:00Z',
    user: { id: 'usr-004', full_name: 'Emily Chen', email: 'emily@example.com', phone: null, avatar_url: null, created_at: '2024-05-24T14:00:00Z' },
  },
  {
    id: 'led-004',
    user_id: 'usr-005',
    source: 'mls_match',
    status: 'cold',
    notes: 'Browsing saved searches. No response to last two emails.',
    tags: [],
    created_at: '2024-05-10T09:00:00Z',
    user: { id: 'usr-005', full_name: 'David Park', email: 'david@example.com', phone: null, avatar_url: null, created_at: '2024-05-10T09:00:00Z' },
  },
  {
    id: 'led-005',
    user_id: 'usr-006',
    source: 'contact_form',
    status: 'closed',
    notes: 'Closed on 312 Oak St in Summerville. Great experience.',
    tags: ['closed', 'referral-potential'],
    created_at: '2024-04-01T10:00:00Z',
    user: { id: 'usr-006', full_name: 'Jessica Turner', email: 'jessica@example.com', phone: '(843) 555-0106', avatar_url: null, created_at: '2024-04-01T10:00:00Z' },
  },
];

// -------------------------------------------------------------------------
// Saved Searches
// -------------------------------------------------------------------------

export const MOCK_SAVED_SEARCHES = [
  {
    id: 'ss-001',
    user_id: 'usr-002',
    name: 'Charleston Historic District — 3BR+',
    filters: { states: ['SC'], city: 'Charleston', min_beds: 3, max_price: 600000 },
    notify_on_new_listings: true,
    created_at: '2024-05-25T10:30:00Z',
  },
  {
    id: 'ss-002',
    user_id: 'usr-002',
    name: 'Mount Pleasant Waterfront',
    filters: { states: ['SC'], city: 'Mount Pleasant', min_price: 500000, property_type: ['Residential'] },
    notify_on_new_listings: false,
    created_at: '2024-05-26T09:00:00Z',
  },
];

// -------------------------------------------------------------------------
// Notifications
// -------------------------------------------------------------------------

export const MOCK_NOTIFICATIONS = [
  {
    id: 'ntf-001',
    user_id: 'usr-002',
    type: 'new_message',
    title: 'New message',
    body: "I've attached the latest market analysis for this area.",
    data: { thread_id: 'thr-002' },
    read_at: null,
    created_at: '2024-05-27T09:15:00Z',
  },
  {
    id: 'ntf-002',
    user_id: 'usr-002',
    type: 'appointment_reminder',
    title: 'Reminder: Property showing tomorrow at 10am',
    body: '214 Broad St, Charleston — 10:00 AM',
    data: { appointment_id: 'apt-001' },
    read_at: null,
    created_at: '2024-05-30T10:00:00Z',
  },
  {
    id: 'ntf-003',
    user_id: 'usr-002',
    type: 'listing_match',
    title: 'New listing matches your search',
    body: '214 Broad St, Charleston SC — $485,000',
    data: { listing_id: 'lst-001' },
    read_at: '2024-05-26T09:00:00Z',
    created_at: '2024-05-25T08:00:00Z',
  },
];

// -------------------------------------------------------------------------
// Agent Status
// -------------------------------------------------------------------------

export const MOCK_AGENT_STATUS = { status: 'online' as const };

// -------------------------------------------------------------------------
// Auth User (simulated logged-in client)
// -------------------------------------------------------------------------

export const MOCK_CLIENT_USER = {
  id: 'usr-002',
  email: 'sarah@example.com',
  user_metadata: { role: 'client', full_name: 'Sarah Johnson' },
};

export const MOCK_AGENT_USER = {
  id: 'usr-001',
  email: 'agent@kaptivatinghomes.com',
  user_metadata: { role: 'agent', full_name: process.env.NEXT_PUBLIC_AGENT_NAME ?? 'Your Agent' },
};

// -------------------------------------------------------------------------
// Agent Schedule
// -------------------------------------------------------------------------

export const MOCK_WEEKLY_AVAILABILITY = [
  { day_of_week: 0, label: 'Sunday',    enabled: false, start_time: '09:00', end_time: '17:00' },
  { day_of_week: 1, label: 'Monday',    enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day_of_week: 2, label: 'Tuesday',   enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day_of_week: 3, label: 'Wednesday', enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day_of_week: 4, label: 'Thursday',  enabled: true,  start_time: '09:00', end_time: '17:00' },
  { day_of_week: 5, label: 'Friday',    enabled: true,  start_time: '09:00', end_time: '15:00' },
  { day_of_week: 6, label: 'Saturday',  enabled: true,  start_time: '10:00', end_time: '14:00' },
];

export const MOCK_BLOCKED_DATES = [
  '2024-07-04',
  '2024-11-28',
  '2024-12-25',
];

export const MOCK_SCHEDULE_APPOINTMENT_TYPES = [
  { id: 'buyer_consultation', name: 'Buyer Consultation', duration_minutes: 60, buffer_minutes: 15, description: 'Discuss needs, budget, and timeline one-on-one.', enabled: true },
  { id: 'property_showing',   name: 'Property Showing',   duration_minutes: 45, buffer_minutes: 15, description: 'Tour a specific property.',                      enabled: true },
  { id: 'offer_review',       name: 'Offer Review',       duration_minutes: 30, buffer_minutes: 10, description: 'Review and discuss a purchase offer.',           enabled: true },
];
