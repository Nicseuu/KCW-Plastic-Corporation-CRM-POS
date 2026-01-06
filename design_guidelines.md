# KCW PLASTIC CORPORATION CRM - Design Guidelines

## Design Approach
**System-Based Approach**: Material Design & Enterprise UI patterns
Reference: Odoo, Linear, SAP Fiori for enterprise application standards
Optimized for: Data density, workflow efficiency, multi-module navigation

## Core Layout System

### Application Shell
**Sidebar Navigation** (Fixed Left, 280px wide)
- Logo placement: Top of sidebar (h-16, centered)
- Module navigation: Stacked vertical list with icons + labels
- User profile & settings: Bottom of sidebar
- Collapsible to icon-only mode (72px) for more screen space

**Main Content Area**
- Dynamic breadcrumb navigation (top-left of content)
- Page title + action buttons (right-aligned)
- Content sections use full available width with max-w-7xl container
- Tabbed interfaces for module subsections (Orders, Inventory, Reports)

### Grid & Spacing System
**Spacing Scale**: Tailwind units of 1, 2, 4, 6, 8, 12, 16, 24
- Component padding: p-4 to p-6
- Section spacing: py-8 to py-12
- Card spacing: gap-4 to gap-6
- Table cell padding: px-4 py-3

## Typography Hierarchy

### Font Stack
- **Primary**: Inter (Google Fonts) - 400, 500, 600, 700
- **Monospace**: JetBrains Mono for order IDs, SKUs, codes

### Type Scale
- Page Titles: text-2xl font-semibold (24px)
- Section Headers: text-lg font-semibold (18px)
- Card Titles: text-base font-medium (16px)
- Body Text: text-sm (14px)
- Table Data: text-sm (14px)
- Labels/Captions: text-xs font-medium uppercase tracking-wide (12px)
- Small Data: text-xs (12px)

## Component Library

### Navigation
- **Top Bar**: Search input (w-80), notification bell, quick actions, user dropdown
- **Sidebar Modules**: CRM, Inbox, Orders, Picklist, Inventory, Reports, Settings
- **Breadcrumbs**: Home > Orders > #ORD-12345

### Data Display
**Tables** (Primary data view)
- Sticky header row with sort indicators
- Row height: h-12 for comfortable scanning
- Alternating row treatment for readability
- Inline action icons (edit, view, delete) on hover
- Bulk selection checkboxes
- Pagination: Bottom-right with items per page selector

**Cards** (Secondary data view)
- Rounded corners: rounded-lg
- Elevation: Subtle shadow
- Header with title + action dropdown
- Content padding: p-6
- Footer for stats/actions

**Stats Widgets** (Dashboard)
- Compact card layout: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Large number display: text-3xl font-bold
- Label below: text-sm
- Trend indicator: Arrow + percentage change

### Forms & Inputs
**Form Layout**
- Two-column grid for wide forms (grid-cols-2 gap-6)
- Single column for mobile (responsive)
- Field groups with section headers
- Required field indicators (*)

**Input Components**
- Text inputs: h-10, rounded-md, px-3
- Dropdowns: Custom select with icons
- Date pickers: Calendar popup
- Search fields: Icon prefix, clear button
- Multi-select: Tag-based chips

### Action Elements
**Buttons**
- Primary action: h-10, px-6, rounded-md, font-medium
- Secondary action: h-10, px-4, rounded-md, font-medium
- Icon buttons: w-10 h-10, rounded-md (for table actions)
- Button groups: Segmented controls for view toggles

**Filters & Controls**
- Filter bar: Horizontal row above tables
- Date range picker prominent placement
- Platform/store selector dropdown
- Quick filter chips (removable tags)

### Modals & Overlays
- **Drawer**: Right-side panel (w-96 to w-1/3) for quick edits
- **Modal**: Centered overlay for forms (max-w-2xl)
- **Popover**: Contextual info on hover
- **Toast**: Top-right notifications (success, error, info)

### Specialized Components

**Inbox/Chat Interface**
- Three-column layout: Contact list (w-80) | Conversation | Customer details (w-96)
- Message bubbles: Left-aligned (customer), right-aligned (agent)
- Quick reply buttons at bottom
- Status indicators (new, waiting, closed)

**Picklist View**
- Groupable table with expand/collapse sections
- Print-optimized layout toggle
- Progress bar showing completion percentage
- Batch action toolbar

**Inventory Dashboard**
- Product card grid with images
- Stock level indicators (low stock warnings in amber)
- Quick stock adjustment inputs
- SKU mapping table with platform columns

**Order Detail View**
- Split layout: Order info (left 2/3) | Timeline (right 1/3)
- Order items table embedded
- Status stepper showing order progression
- Action buttons context-aware based on status

## Visual Rhythm & Layout Patterns

**Dashboard Pages**: 
- Welcome banner with key metrics (h-32)
- Quick actions grid (3-4 cards)
- Recent activity list
- Chart widgets (2-column on desktop)

**List Pages**:
- Toolbar (h-16): Search + Filters + Actions
- Table: Full height with virtual scrolling
- Sticky pagination footer

**Detail Pages**:
- Header bar (h-20): Title + Status badge + Actions
- Tabs for sections (Info, Items, History, Notes)
- Content in cards with appropriate spacing

## Responsive Behavior
- Desktop (lg:): Full three-column layouts, sidebar visible
- Tablet (md:): Collapsible sidebar, two-column forms
- Mobile: Hamburger menu, stacked single-column, bottom action bars

## Logo Integration
- Primary: Top of sidebar, full logo on white/light background
- Secondary: Login page, centered above form
- Favicon: Icon version for browser tabs
- Size: h-12 in sidebar, h-16 on login

## Images
**No hero images** - This is an enterprise application, not a marketing site. Focus on data visualization, charts, and functional UI elements. Product images appear within inventory cards and order line items only.