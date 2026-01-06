# KCW PLASTIC CORPORATION CRM

## Overview

This is an enterprise-grade CRM (Customer Relationship Management) system for KCW Plastic Corporation, built in the style of Odoo. The platform centralizes customers, conversations, orders, inventory, picklists, and analytics across multiple sales channels including TikTok Shop, Shopee, Lazada, and manual sales.

The system is designed as a modular, API-first application with modules for:
- Customer management with unified identity across platforms
- Unified inbox for customer conversations
- Order management with multi-platform support
- Picklist generation for warehouse operations
- Inventory/product management with SKU tracking
- Reporting and analytics
- System settings and configuration

**Currency**: Philippine Peso (PHP)  
**Timezone**: Asia/Manila  
**Date format**: YYYY-MM-DD

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Visual Architecture
A visual representation of the system architecture can be found in `public/diagrams/architecture.mermaid`. This diagram illustrates the flow from external platforms through the integrations service to the core data layer, and how operation and read-only modules interact with that layer.

### Core Engine
The system is built as a unified data engine where all modules read from and write to a central core (Users, Products, Customers, Orders, Inventory, Payments, Messages). No module communicates directly with another; all interactions flow through the core data layer.

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark mode support)
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

The frontend follows a page-based structure with shared components. Each module (CRM, Orders, Inventory, etc.) has its own page component under `client/src/pages/`.

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful JSON APIs under `/api/*` prefix
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Schema Validation**: Zod with drizzle-zod for type-safe schemas
- **Real-time Updates**: WebSocket server at `/ws` for stock updates

The backend uses a storage interface pattern (`server/storage.ts`) that abstracts data operations, making it easy to swap implementations.

### API Contracts
- **Auth**: `POST /auth/login`, `GET /auth/me`
- **Inventory**: `GET /products`, `POST /products`, `PUT /products/{id}`, `GET /inventory`, `POST /inventory/import`, `POST /inventory/adjust`
- **POS**: `POST /pos/sale/start`, `POST /pos/sale/add-item`, `POST /pos/sale/complete` (Deducts stock only after payment)
- **CRM**: `GET /customers`, `POST /customers`, `GET /customers/{id}/orders`
- **Inbox**: `GET /messages`, `POST /messages/sync`, `POST /messages/convert-to-order`
- **Orders**: `GET /orders`, `POST /orders`, `PUT /orders/{id}/status`
- **Picklist**: `GET /picklists`, `POST /picklists/{id}/pick`, `POST /picklists/{id}/complete`
- **Payments**: `POST /payments`, `GET /payments/{order_id}`
- **Reports**: `GET /reports/sales`, `GET /reports/products`, `GET /reports/customers` (Read only)
- **Integrations**: `POST /integrations/connect`, `POST /integrations/sync`, `GET /integrations/status`

### Real-time Features
- **WebSocket Path**: `/ws` - broadcasts stock updates to connected clients
- **Stock Updates**: Automatically pushed when products are edited or order items are created
- **Frontend Hook**: `useStockUpdates()` hook in `client/src/hooks/use-stock-updates.ts` handles WebSocket connection and TanStack Query cache updates

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Location**: `shared/schema.ts` - contains all table definitions shared between client and server
- **Migrations**: Managed via `drizzle-kit push`

Core entities include: Users, Customers, Products, Orders, OrderItems, Picklists, Conversations, and Messages.

## AI Build Instructions
- **Dashboard**: Aggregates data; read-only. Show today sales, orders, customers, low stock.
- **POS**: Live selling; search/scan; validate stock; checkout creates order/payment; deducts stock after payment.
- **CRM**: Customer management; creation from POS/Inbox; no stock movement. Show contact info, history, spend.
- **Inbox**: Unified inbox; sync from all platforms; link to customers; chat-to-order conversion.
- **Orders**: Lifecycle management; status flow; paid orders trigger picklist.
- **Picklist**: Warehouse fulfillment; confirm picked qty; updates order status/inventory logs.
- **Inventory**: Stock management; available/reserved stock; log every change with reason.
- **Reports**: Analytics only; read-only; date filters and exports.
- **Integrations**: Platform connectors; secure credentials; manual sync.

## Final System Principle
- POS sells.
- Inbox talks.
- CRM remembers.
- Orders control.
- Picklist fulfills.
- Inventory protects.
- Reports explain.
- Integrations connect.

### Shared Code
The `shared/` directory contains code used by both frontend and backend:
- Database schema definitions
- Type exports
- Validation schemas
- Constants (customer stages, platforms, order statuses)

### Build System
- Development: Vite dev server with HMR, Express backend via tsx
- Production: Vite builds frontend to `dist/public`, esbuild bundles server to `dist/index.cjs`
- Single command deployment with `npm run build` and `npm start`

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Database toolkit for type-safe queries and migrations

### UI Framework
- **Radix UI**: Headless component primitives (dialogs, dropdowns, tabs, etc.)
- **shadcn/ui**: Pre-styled component library using Radix primitives
- **Tailwind CSS**: Utility-first CSS framework

### Data & Forms
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form state management
- **Zod**: Schema validation

### Additional Libraries
- **date-fns**: Date manipulation
- **xlsx**: Excel file handling for import/export functionality
- **Lucide React**: Icon library
