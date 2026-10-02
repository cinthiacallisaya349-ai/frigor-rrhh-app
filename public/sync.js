// Puente genérico entre las herramientas (que están hechas para guardar todo
// en localStorage, en el navegador) y la base de datos compartida del
// servidor. No conoce nada de organigramas ni de perfiles de cargo: solo
// copia claves de localStorage hacia/desde el servidor.
//
// Uso: <script src="/sync.js" data-module="organigramas" data-exclude="clave1,clave2"></script>
// colocado ANTES que el script principal de la herramienta.
//
// data-module: nombre del módulo en el servidor ("organigramas" | "perfiles").
// data-exclude: claves de localStorage que son preferencias del propio
//               navegador (por ejemplo, vista vertical/horizontal) y que NO
//               queremos compartir entre todas las personas del área.

(function () {
  var scriptEl = document.currentScript;
  var moduleName = scriptEl.getAttribute("data-module");
  var excludeAttr = scriptEl.getAttribute("data-exclude") || "";
  var exclude = {};
  excludeAttr
    .split(",")
    .map(function (s) {
      return s.trim();
    })
    .filter(Boolean)
    .forEach(function (k) {
      exclude[k] = true;
    });

  if (!moduleName) {
    console.warn("[frigor-sync] falta data-module en el <script src=\"/sync.js\">");
    return;
  }

  // 1) Traer lo guardado en el servidor ANTES de que la herramienta arranque,
  //    y precargarlo en localStorage. Así, cuando el script de la
  //    herramienta lea localStorage (como ya lo hacía antes), en realidad
  //    está leyendo los datos del servidor, sin que haya que tocar su código.
  try {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/state/" + moduleName, false); // false = síncrono, a propósito
    xhr.send(null);
    if (xhr.status === 200) {
      var serverData = JSON.parse(xhr.responseText || "{}");
      Object.keys(serverData).forEach(function (key) {
        if (exclude[key]) return;
        var value = serverData[key];
        if (value === null || value === undefined) return;
        window.localStorage.setItem(key, value);
      });
    } else if (xhr.status === 401) {
      window.location.href = "/login.html";
      return;
    }
  } catch (e) {
    console.warn(
      "[frigor-sync] no se pudo leer el estado del servidor; se usa la copia de este navegador.",
      e
    );
  }

  // 2) De ahora en más, cada vez que la herramienta guarde algo en
  //    localStorage, lo mandamos también al servidor (con un pequeño
  //    retraso para agrupar varios cambios seguidos en un solo envío).
  var pending = false;
  function pushToServer() {
    if (pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      var snapshot = {};
      for (var i = 0; i < window.localStorage.length; i++) {
        var key = window.localStorage.key(i);
        if (exclude[key]) continue;
        snapshot[key] = window.localStorage.getItem(key);
      }
      fetch("/api/state/" + moduleName, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }).catch(function (e) {
        console.warn(
          "[frigor-sync] no se pudo guardar en el servidor; se reintenta con el próximo cambio.",
          e
        );
      });
    }, 500);
  }

  var realSetItem = window.localStorage.setItem.bind(window.localStorage);
  window.localStorage.setItem = function (key, value) {
    realSetItem(key, value);
    if (!exclude[key]) pushToServer();
  };
})();
