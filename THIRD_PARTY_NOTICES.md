# Third-party notices

## shadcn-admin

Source: https://github.com/satnaing/shadcn-admin

Pinned commit: `e16c87f213a5ba5e45964e9b67c792105ec74d26`

Source tree: https://github.com/satnaing/shadcn-admin/tree/e16c87f213a5ba5e45964e9b67c792105ec74d26

Retrieved from the official repository on 2026-10-28. This is a selective source
adaptation, not a wholesale installation of the upstream application.

Adapted source files at that commit:

| Upstream file | Local adaptation |
| --- | --- |
| `src/components/layout/main.tsx` | `src/components/admin/AdminMain.tsx`: main element, fixed/fluid options, class composition; local width and focus target |
| `src/components/layout/authenticated-layout.tsx` | `src/components/admin/AdminLayout.tsx`: sidebar plus inset content composition and skip-to-main; local session gate in AdminApp |
| `src/components/layout/app-sidebar.tsx` | `src/components/admin/AdminLayout.tsx`: header/content/footer sidebar organization; only implemented navigation retained |
| `src/components/layout/header.tsx` | `src/components/admin/AdminLayout.tsx`: header inner row, sidebar trigger and vertical separator; sticky local header without scroll effects |
| `src/features/dashboard/index.tsx` | `src/components/admin/AdminDashboard.tsx`: heading/action row, metric cards and seven-column lower grid; live summary replaces all sample content |
| `src/features/auth/sign-in/index.tsx` | `src/components/admin/AdminLogin.tsx`: sign-in Card/Header/Description/Content composition; native form and real same-origin auth replace demo behavior |

Local adaptations reuse this project's shadcn/Radix components, semantic color
tokens and Remix Icon adapter. Upstream router, providers, Lucide icons, charts,
Clerk integration, mock authentication, sample metrics and unimplemented actions
are not included. Local `adminApi.ts` and `AdminApp.tsx` provide project-specific
API validation and session handling rather than upstream mock authentication.

The following upstream MIT license applies to the adapted portions and must be
retained when distributing copies or substantial portions of them.

### License

MIT License

Copyright (c) 2024 Sat Naing

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
