/* theme: apply a saved theme before first paint (the 404 page) */
(function () { try { var t = localStorage.getItem("theme"); if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t); } catch (e) {} })();
