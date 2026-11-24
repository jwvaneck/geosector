(() => {
  const root = document.getElementById("geo-bedrijfsnamen-map");
  const svg = root.querySelector(".bedrijf-map");
  const selector = root.querySelector("select");
  const detail = root.querySelector("[data-company-detail]");
  const {companies,basemap,bounds,anchors} = window.GeoSectorData.map;
  const companyById = new Map(companies.map(company => [company.id,company]));
  const names = {naam:"Nieuwe naam",over:"Opgegaan of opgevolgd",stop:"Opgeheven"};
  const colors = {naam:"var(--viz-series-1,var(--blue))",over:"var(--viz-series-2,var(--green))",stop:"var(--viz-series-3,var(--orange))"};
  let selected = null;
  root.closest(".pane").querySelector("[data-map-count]").textContent = companies.length+" bedrijven";
  for (const company of companies) selector.append(new Option(company.name+" · "+company.place, company.id));

  function svgElement(tag,attributes={}) {
    const item = document.createElementNS("http://www.w3.org/2000/svg",tag);
    for (const [key,value] of Object.entries(attributes)) item.setAttribute(key,String(value));
    return item;
  }

  function spread(points,gap,width,height) {
    const used = [];
    return points.map(point=>{
      const [x,y] = point;
      const candidates = [[x,y]];
      for (const distance of [gap,gap*1.5,gap*2.2]) {
        for (let i=0;i<12;i++) {
          const angle = Math.PI*i/6;
          candidates.push([x+distance*Math.cos(angle),y+distance*Math.sin(angle)]);
        }
      }
      const result = candidates.find(([a,b])=>a>12&&a<width-12&&b>12&&b<height-12&&
        used.every(([px,py])=>Math.hypot(px-a,py-b)>=gap-.01)) || point;
      used.push(result);
      return result;
    });
  }

  function draw() {
    const {width,height} = svg.getBoundingClientRect();
    if (!width || !height) return;
    svg.replaceChildren();
    const [[west,north],[east,south]]=bounds;
    const scale=Math.min((width-30)/(east-west),(height-26)/(south-north));
    const tx=(width-scale*(east+west))/2;
    const ty=(height-scale*(north+south))/2;
    const pixel=([x,y])=>[x*scale+tx,y*scale+ty];
    const land=svgElement("g",{transform:"translate("+tx+" "+ty+") scale("+scale+")"});
    for (const d of basemap) {
      land.append(svgElement("path",{d,fill:"var(--muted)",stroke:"var(--border)","vector-effect":"non-scaling-stroke","stroke-width":1}));
    }
    svg.append(land);

    const geographic = companies.map(company=>pixel(company.point));
    const markers = spread(geographic,width<440?18:20,width,height);
    const referenceCities = width<440 ? new Set(["Groningen","Zwolle","Amsterdam","Rotterdam","Eindhoven","Maastricht"]) : null;
    const labelBoxes = [];
    for(const city of anchors) {
      if (referenceCities && !referenceCities.has(city.name)) continue;
      const [x,y]=pixel(city.point);
      const textWidth=city.name.length*6.4;
      const positions=[[x+4,y-6],[x+4,y+12],[x-textWidth-4,y-6],[x-textWidth-4,y+12]];
      const spot=positions.find(([a,b])=>a>4&&a+textWidth<width-4&&b>12&&b<height-3&&
        markers.every(([px,py])=>px<a-8||px>a+textWidth+8||py<b-16||py>b+7)&&
        labelBoxes.every(([px,py,l])=>Math.abs(py-b)>12||px>a+textWidth+4||px+l<a-4));
      if(!spot) continue;
      const [left,top]=spot;
      const cityLabel=svgElement("text",{x:left,y:top,class:"bedrijf-label"});
      cityLabel.textContent=city.name;
      svg.append(svgElement("circle",{cx:x,cy:y,r:1.8,fill:"var(--muted-foreground)"}),cityLabel);
      labelBoxes.push([left,top,textWidth]);
    }
    for (const [index,[x,y]] of markers.entries()) {
      const [originalX,originalY]=geographic[index];
      if (Math.hypot(x-originalX,y-originalY)>1) {
        svg.append(svgElement("line",{x1:originalX,y1:originalY,x2:x,y2:y,stroke:"var(--muted-foreground)","stroke-width":1,"pointer-events":"none"}));
        svg.append(svgElement("circle",{cx:originalX,cy:originalY,r:1.5,fill:"var(--muted-foreground)","pointer-events":"none"}));
      }
    }
    for (const [index,company] of companies.entries()) {
      const [x,y]=markers[index];
      if(selected?.id===company.id) {
        svg.append(svgElement("circle",{cx:x,cy:y,r:10.3,fill:"none",stroke:"var(--foreground)","stroke-width":1.5}));
      }
      const styles={fill:colors[company.kind],stroke:"var(--background)","stroke-width":1.3};
      const icon=company.kind==="naam" ? svgElement("circle",{cx:x,cy:y,r:6.5,...styles}) :
        svgElement("rect",{x:x-5.6,y:y-5.6,width:11.2,height:11.2,...styles,
          ...(company.kind==="over"?{transform:"rotate(45 "+x+" "+y+")"}:{})});
      svg.append(icon);
      const target=svgElement("circle",{cx:x,cy:y,r:8.8,fill:"transparent",class:"cursor-interaction",
        "data-tooltip":company.name+" · "+company.place+" · "+names[company.kind]});
      const title = svgElement("title");
      title.textContent = target.getAttribute("data-tooltip");
      target.append(title);
      target.addEventListener("click",()=>select(company.id,true));
      svg.append(target);
    }
  }

  function select(id,persist=false) {
    selected=companyById.get(id)||null;
    selector.value=selected?.id||"";
    detail.replaceChildren();
    if(selected) {
      const title=document.createElement("h3");
      title.textContent=selected.name+" → "+selected.newName;
      const meta=document.createElement("p");
      meta.className="text-small text-muted";
      meta.textContent=selected.place+" · "+selected.postcode+" in 2019 · "+names[selected.kind]+(selected.year ? " · "+selected.year : "");
      const annotation=document.createElement("p");
      annotation.textContent=selected.description;
      const links=document.createElement("p");
      links.className="text-small";
      selected.sources.forEach((url,index)=>{
        if(index) links.append(" · ");
        const anchor=document.createElement("a");
        anchor.href=url;
        anchor.target="_blank";
        anchor.rel="noopener noreferrer";
        anchor.textContent=selected.sources.length===1?"Bron":"Bron "+(index+1);
        links.append(anchor);
      });
      detail.append(title,meta,annotation,links);
    }
    draw();
    if (persist) root.dispatchEvent(new CustomEvent("geosector:selection",{detail:{id:selected?.id || ""}}));
  }
  selector.addEventListener("change",()=>select(selector.value,true));
  new ResizeObserver(draw).observe(svg);
  select("");
})();
