# Replace react-router-dom imports
s/from ["']react-router-dom["']/from "@\/navigation"/g
s/from ["']react-router["']/from "@\/navigation"/g

# Handle specific imports
s/import {[^}]*RouterProvider[^}]*} from "@\/navigation"/import {NavigationProvider, Router} from "@\/navigation"/g
s/import {[^}]*createBrowserRouter[^}]*} from "@\/navigation"//g
s/import {[^}]*createRoutesFromElements[^}]*} from "@\/navigation"//g
s/import {[^}]*Route[^}]*} from "@\/navigation"//g
s/import {[^}]*Routes[^}]*} from "@\/navigation"//g
s/import {[^}]*Outlet[^}]*} from "@\/navigation"//g
EOF < /dev/null