(() => {
  const root = document.getElementById("geosector-netwerk");
  const graph = root.querySelector(".network");
  const chooser = root.querySelector("select");
  const summary = root.closest(".pane").querySelector("[data-network-summary]");
  const detail = root.querySelector("[data-network-detail]");
  const data = window.GeoSectorData.network;
  const svgNS = "http://www.w3.org/2000/svg";
  const nodes = data.nodes.map(([id,name,type,member,memberName,postcode,status,degree,x,y]) =>
    ({id,name,type,member,memberName,postcode,status,degree,x,y}));
  const byId = new Map(nodes.map(node => [node.id,node]));
  const shownInOverview = nodes.filter(node => node.degree);
  const byName = (a,b) => a.name.localeCompare(b.name,"nl",{sensitivity:"base"});
  const collator = new Intl.Collator("nl",{sensitivity:"base"});
  const membershipColor = "var(--viz-series-1,var(--blue))";
  const partnerColor = "var(--viz-series-2,var(--green))";
  const supplierColor = "var(--viz-series-3,var(--orange))";
  const otherColor = "var(--muted-foreground)";
  const duplicates = new Map();
  for (const node of nodes) duplicates.set(node.name,(duplicates.get(node.name)||0)+1);
  const documented = document.createElement("optgroup");
  documented.label = "Met gedocumenteerde relaties";
  const unconnected = document.createElement("optgroup");
  unconnected.label = "Zonder gedocumenteerde relaties in dit overzicht";
  for (const node of [...nodes].sort(byName)) {
    const suffix = duplicates.get(node.name) > 1 ? " · " + node.id : "";
    (node.degree ? documented : unconnected).append(new Option(node.name + suffix,node.id));
  }
  chooser.append(documented,unconnected);

  function element(name,settings={}) {
    const mark = document.createElementNS(svgNS,name);
    for (const [key,value] of Object.entries(settings)) mark.setAttribute(key,String(value));
    return mark;
  }

  function positionLabel(node,x,y,width,alignment,maxLength) {
    const label = element("text",{
      x:Math.max(8,Math.min(width-8,x)),y,class:"network-label",
      "text-anchor":alignment,"dominant-baseline":"middle",
    });
    const name = node.name;
    label.textContent = name.length > maxLength ? name.slice(0,maxLength-1).trimEnd()+"…" : name;
    return label;
  }

  function color(edge) {
    if (edge[2] === "is partner van") return partnerColor;
    if (edge[2] === "is leverancier aan") return supplierColor;
    return otherColor;
  }

  function renderGraph(selected,adjacent) {
    const width = Math.round(graph.getBoundingClientRect().width);
    const height = Math.round(graph.getBoundingClientRect().height);
    if (!width || !height) return;
    graph.replaceChildren();
    const empty = Boolean(selected && adjacent.length===0);
    graph.toggleAttribute("hidden",empty);
    if (empty) return;
    const defs = element("defs");
    const marker = element("marker",{
      id:"geosector-pijl",viewBox:"0 0 8 8",refX:7,refY:4,
      markerWidth:6,markerHeight:6,orient:"auto-start-reverse",
    });
    marker.append(element("path",{d:"M0 0 L8 4 L0 8 Z",fill:supplierColor}));
    defs.append(marker);
    graph.append(defs);

    const size = node => selected ? (node.id === selected.id ? 8 : 5.5) : (3+Math.sqrt(node.degree)*1.15);
    let displayed = shownInOverview;
    const points = new Map();
    if (selected) {
      const neighbourIds = new Set(adjacent.map(edge=>edge[0]===selected.id ? edge[1] : edge[0]));
      const neighbours = [...neighbourIds].map(id=>byId.get(id)).sort(byName);
      displayed = [selected,...neighbours];
      points.set(selected.id,[width/2,height/2]);
      const columns = [neighbours.slice(0,Math.ceil(neighbours.length/2)),neighbours.slice(Math.ceil(neighbours.length/2))];
      for (const [column,batch] of columns.entries()) {
        const left = column===0;
        const yStep = Math.min(44,(height-48)/Math.max(1,batch.length));
        const x = left ? width*.32 : width*.68;
        for (const [i,node] of batch.entries()) {
          points.set(node.id,[x,height/2+(i-(batch.length-1)/2)*yStep]);
        }
      }
    } else {
      for (const node of displayed) points.set(node.id,[22+node.x*(width-44),16+node.y*(height-32)]);
    }
    const visibleEdges = selected ? adjacent : data.edges;
    const linkGroup = element("g",{"pointer-events":"none"});
    for (const edge of visibleEdges) {
      const [x1,y1] = points.get(edge[0]);
      const [x2,y2] = points.get(edge[1]);
      const dist = Math.hypot(x2-x1,y2-y1)||1;
      const offset = selected ? size(byId.get(edge[1]))+2 : 0;
      const params = {
        x1,y1,x2:x2-(x2-x1)/dist*offset,y2:y2-(y2-y1)/dist*offset,
        stroke:color(edge),"stroke-width":selected ? 1.6 : 1.1,
        "stroke-opacity":selected ? .85 : (color(edge)===otherColor ? .31 : .54),
      };
      if (color(edge)===otherColor) params["stroke-dasharray"] = "3 3";
      if (selected && edge[2]==="is leverancier aan") params["marker-end"] = "url(#geosector-pijl)";
      linkGroup.append(element("line",params));
    }
    graph.append(linkGroup);
    const labels = element("g",{"pointer-events":"none"});
    const labelCandidates = selected ? displayed.filter(node=>node.id!==selected.id) :
      [...displayed].sort((a,b)=>b.degree-a.degree).slice(0,width<490?8:14);
    const placed = [];
    for (const node of labelCandidates) {
      const [x,y] = points.get(node.id);
      const left = selected ? x<width/2 : x>width*.6;
      const max = selected ? Math.max(8,Math.floor(width*.30/6.6)) : (width<490?17:25);
      const len = Math.min(node.name.length,max)*6.4;
      const labelX = x+(left?-1:1)*(size(node)+4);
      const leftEdge = left ? labelX-len : labelX;
      if (!selected && (leftEdge<3 || leftEdge+len>width-3 || placed.some(p=>Math.abs(p.y-y)<16 && p.x<leftEdge+len+7 && p.x+p.len>leftEdge-7))) continue;
      placed.push({x:leftEdge,y,len});
      labels.append(positionLabel(node,labelX,y,width,left?"end":"start",max));
    }
    for (const node of [...displayed].sort((a,b)=>a.degree-b.degree)) {
      const [x,y] = points.get(node.id);
      const active = selected?.id === node.id;
      const filled = node.member === "Ja";
      const dot = element("circle",{
        cx:x,cy:y,r:size(node),fill:filled?membershipColor:"var(--background)",
        stroke:active?"var(--foreground)":filled?"var(--background)":otherColor,
        "stroke-width":active?2.1:1.15,
        "data-tooltip":node.name+" · "+node.degree+" "+(node.degree===1?"relatie":"relaties")+" · "+node.member,
        class:"cursor-interaction",
      });
      const title = element("title");
      title.textContent = dot.getAttribute("data-tooltip");
      dot.append(title);
      dot.addEventListener("click",()=>select(node.id,true));
      graph.append(dot);
    }
    graph.append(labels);
  }

  function renderDetail(selected,adjacent) {
    detail.replaceChildren();
    if (!selected) return;
    const heading = document.createElement("h3");
    heading.textContent = selected.name;
    const lines = document.createElement("p");
    lines.className = "text-small";
    const match = selected.memberName && collator.compare(selected.name,selected.memberName) !== 0 ? " ("+selected.memberName+")" : "";
    const postcode = selected.postcode ? " · Postcode 2019 "+selected.postcode : "";
    lines.textContent = selected.type+" · GeoBusiness NL: "+selected.member+match+postcode;
    detail.append(heading,lines);
    if (!adjacent.length) return;
    const disclosure = document.createElement("details");
    disclosure.open = true;
    const disclosureLabel = document.createElement("summary");
    disclosureLabel.className = "cursor-interaction";
    disclosureLabel.textContent = "Relaties en bronnen ("+adjacent.length+")";
    disclosure.append(disclosureLabel);
    const list = document.createElement("ul");
    for (const [a,b,type,description,period,source] of adjacent) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = source;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Bron";
      link.setAttribute("aria-label","Bron van de relatie tussen "+byId.get(a).name+" en "+byId.get(b).name);
      const title = document.createElement("span");
      title.textContent = byId.get(a).name+" "+type+" "+byId.get(b).name+". ";
      const meta = document.createElement("p");
      meta.className = "text-small";
      meta.textContent = description+(period ? " "+period+"." : "")+" ";
      meta.append(link);
      li.append(title,meta);
      list.append(li);
    }
    disclosure.append(list);
    detail.append(disclosure);
  }

  let selected = null;
  let adjacent = [];
  function select(id,persist=false) {
    selected = byId.get(id) || null;
    chooser.value = selected?.id || "";
    adjacent = selected ? data.edges.filter(edge=>edge[0]===selected.id || edge[1]===selected.id) : [];
    summary.textContent = selected ?
      selected.name+" · "+adjacent.length+" "+(adjacent.length===1?"relatie":"relaties") :
      shownInOverview.length+" gekoppelde vermeldingen · "+data.edges.length+" relaties";
    root.querySelector(".empty-network").hidden = !(selected && adjacent.length===0);
    graph.removeAttribute("hidden");
    renderGraph(selected,adjacent);
    renderDetail(selected,adjacent);
    if (persist) root.dispatchEvent(new CustomEvent("geosector:selection",{detail:{id:selected?.id || ""}}));
  }
  chooser.addEventListener("change",()=>select(chooser.value,true));
  new ResizeObserver(()=>renderGraph(selected,adjacent)).observe(root);
  select("");
})();
