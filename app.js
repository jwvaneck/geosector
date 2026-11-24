(() => {
  const {map,network} = window.GeoSectorData;
  const mapKinds = {naam:"Nieuwe naam",over:"Opgegaan of opgevolgd",stop:"Opgeheven"};
  const fold = (text) => String(text || "").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase();
  const views = {
    kaart:{
      root:document.getElementById("geo-bedrijfsnamen-map"),
      list:document.querySelector("[data-map-results]"),
      input:document.getElementById("map-search"),
      records:map.companies.map((entry)=>({
        id:entry.id, name:entry.name, meta:entry.place+" · "+mapKinds[entry.kind],
        match:fold([entry.name,entry.newName,entry.place,entry.postcode].join(" ")),
      })),
    },
    netwerk:{
      root:document.getElementById("geosector-netwerk"),
      list:document.querySelector("[data-network-results]"),
      input:document.getElementById("network-search"),
      records:network.nodes
        .map(([id,name,type,member,memberName,postcode,status,degree])=>({
          id,name,degree,meta:degree+" "+(degree===1?"relatie":"relaties")+(member==="Ja"?" · Lid GeoBusiness NL":""),
          match:fold([name,memberName,type,postcode].join(" ")),
        }))
        .sort((a,b)=>b.degree-a.degree || a.name.localeCompare(b.name,"nl")),
    },
  };
  for (const [name,view] of Object.entries(views)) {
    view.pane = document.getElementById(name+"-pane");
    view.select = view.root.querySelector("select");
    view.count = name==="kaart" ? map.companies.length : 12;
    view.input.addEventListener("input",()=>renderResults(view));
    view.input.addEventListener("keydown",(event)=>{
      if (event.key==="Enter") view.list.querySelector("button")?.click();
    });
    view.root.addEventListener("geosector:selection",()=>{
      const id = view.select.value;
      history.replaceState(null,"","#"+name+(id ? "/"+encodeURIComponent(id) : ""));
      for (const button of view.list.querySelectorAll("button[data-id]")) {
        button.setAttribute("aria-pressed",String(button.dataset.id===id));
      }
    });
    renderResults(view);
  }

  function renderResults(view) {
    const q = fold(view.input.value).trim();
    const hits = q ? view.records.filter(row=>row.match.includes(q)) : view.records.slice(0,view.count);
    const result = document.createDocumentFragment();
    for (const record of hits) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = record.id;
      button.setAttribute("aria-pressed",String(view.select.value===record.id));
      const name = document.createElement("span");
      name.textContent = record.name;
      const metadata = document.createElement("span");
      metadata.textContent = record.meta;
      button.append(name,metadata);
      button.addEventListener("click",()=>choose(view,record.id));
      result.append(button);
    }
    if (!hits.length) {
      const message = document.createElement("p");
      message.textContent = "Geen resultaten.";
      result.append(message);
    }
    view.list.replaceChildren(result);
  }

  function choose(view,id) {
    if (![...view.select.options].some(option=>option.value===id)) return;
    view.select.value = id;
    view.select.dispatchEvent(new Event("change"));
  }

  function navigate() {
    const [name,id] = location.hash.slice(1).split("/");
    if (name && !Object.hasOwn(views,name)) return;
    const active = name || "kaart";
    for (const [key,view] of Object.entries(views)) view.pane.hidden = key!==active;
    for (const link of document.querySelectorAll("[data-tab]")) {
      if (link.dataset.tab===active) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    const view = views[active];
    if (id && view.select.value!==id) choose(view,id);
  }

  window.addEventListener("hashchange",navigate);
  navigate();
})();
