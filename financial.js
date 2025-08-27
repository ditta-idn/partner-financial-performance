// Financial Metrics Dashboard (dummy data) — Plotly
(function(){
  const diag = document.getElementById('diag');
  function log(msg){ if(diag){ diag.innerHTML = msg; } }
  function ensurePlotly(){ return !!window.Plotly; }

  const now = new Date();
  function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }
  function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
  function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
  function monthShort(y,m){ return new Date(y,m,1).toLocaleString('en-US',{month:'short', year:'2-digit'}); }
  function dayLabel(d){ return d.toString(); }

  // Seeded RNG
  function mulberry32(a){ return function(){ let t=a += 0x6D2B79F5; t = Math.imul(t ^ t>>>15, t | 1); t ^= t + Math.imul(t ^ t>>>7, t | 61); return ((t ^ t>>>14) >>> 0) / 4294967296; } }
  let rng = mulberry32(987654);
  function rand(a=0,b=1){ return a + (b-a)*rng(); }
  function choice(arr){ return arr[Math.floor(rand(0,arr.length))]; }

  // Dimensions
  const Countries = ["Indonesia","Malaysia","Phillipine","Thailand","Vietnam"];
  const PartnerCats = ["VC Partner","Referral partner","AM managed Partners","Alliance Partner","Distribution Partner","TPI Partner","Embedded partner","Refferal Others"];
  const Agreements = ["Revenue Sharing","Non Revenue Sharing"];
  const Industries = ["Digital Product","Entertainment","Property","Financial Service","Travel&Hospitality","Non Profit","Retail","Services","Other"];
  const CPMs = ["Charisse","OT","Hanna","Rizki"];
  const Products = ["VA","eWallet","Cards","Direct Debit","QR Code"];
  const LeadFlows = ["Self Serve","Sales","CPM"];
  const MktActs = ["Event campaign","Campaign","Non Marketing"];

  // Mock partners
  const Partners = Array.from({length: 220}).map((_,i)=>{
    const product = choice(Products);
    const industry = choice(Industries);
    const country = choice(Countries);
    const baseTPV = (
      product==='Cards' ? rand(400000, 5000000) :
      product==='eWallet' ? rand(250000, 3000000) :
      product==='QR Code' ? rand(180000, 1500000) :
      product==='Direct Debit'? rand(120000, 900000) :
      rand(150000, 1200000)
    );
    const grossRate = rand(0.006, 0.02);
    const netRate   = Math.max(0.002, grossRate - rand(0.001, 0.006));
    const netNetRate= Math.max(0.001, netRate   - rand(0.0005, 0.004));
    const monthsAgo = Math.floor(rand(0, 20));
    const activation = new Date(now.getFullYear(), now.getMonth()-monthsAgo, 1 + Math.floor(rand(0,25)));
    return { id:'P'+(i+1), country, partnerCat:choice(PartnerCats), agreement:choice(Agreements), industry, cpm:choice(CPMs), product, lead:choice(LeadFlows), mkt:choice(MktActs), activation, baseTPV, grossRate, netRate, netNetRate };
  });

  function seasonalFactor(month, industry){
    let f = 1.0;
    if(industry==='Retail'){ if(month===10||month===11) f += 0.18; if(month===0) f -= 0.05; }
    if(industry==='Travel&Hospitality'){ if(month===5||month===6) f += 0.15; if(month===1) f -= 0.05; }
    if(industry==='Entertainment'){ if(month===11) f += 0.10; }
    return f;
  }

  function getFilters(){
    return {
      country: document.getElementById('f_country').value,
      partnerCat: document.getElementById('f_partnerCat').value,
      agreement: document.getElementById('f_agreement').value,
      industry: document.getElementById('f_industry').value,
      cpm: document.getElementById('f_cpm').value,
      product: document.getElementById('f_product').value,
      lead: document.getElementById('f_lead').value,
      mkt: document.getElementById('f_mkt').value,
      age: document.getElementById('f_age').value,
    };
  }

  function partnerMatches(p, f){
    if(f.country!=='All' && p.country!==f.country) return false;
    if(f.partnerCat!=='All' && p.partnerCat!==f.partnerCat) return false;
    if(f.agreement!=='All' && p.agreement!==f.agreement) return false;
    if(f.industry!=='All' && p.industry!==f.industry) return false;
    if(f.cpm!=='All' && p.cpm!==f.cpm) return false;
    if(f.product!=='All' && p.product!==f.product) return false;
    if(f.lead!=='All' && p.lead!==f.lead) return false;
    if(f.mkt!=='All' && p.mkt!==f.mkt) return false;
    const monthsActive = (now.getFullYear()-p.activation.getFullYear())*12 + (now.getMonth()-p.activation.getMonth()) - (now.getDate()<p.activation.getDate()?1:0);
    if(f.age==='Less than 6 months transacting' && monthsActive>=6) return false;
    if(f.age==='More than 6 months transacting' && monthsActive<6) return false;
    return true;
  }

  // Create monthly totals for last 12 months and daily series for last 4 months
  function buildSeries(filters=getFilters()){
    const months12 = [], months4 = [];
    for(let k=11;k>=0;k--){
      const d = startOfMonth(addMonths(now, -k));
      const obj = { y:d.getFullYear(), m:d.getMonth(), dim:daysInMonth(d.getFullYear(), d.getMonth()) };
      months12.push(obj);
      if(k<=3) months4.push(obj);
    }
    const selected = Partners.filter(p=>partnerMatches(p, filters));
    const monthly = months12.map(_=>({ tpv:0, gross:0, net:0, netnet:0 }));
    const daily = months4.map(m=>({ days: Array.from({length:m.dim},()=>({tpv:0,gross:0,net:0,netnet:0})) }));

    selected.forEach(p=>{
      months12.forEach((mo, idx)=>{
        const monthStart = new Date(mo.y, mo.m, 1);
        if(p.activation > new Date(mo.y, mo.m, mo.dim)) return;
        const monthsActive = (monthStart.getFullYear()-p.activation.getFullYear())*12 + (monthStart.getMonth()-p.activation.getMonth());
        const growth = Math.min(1 + 0.015*monthsActive, 2.1);
        const season = seasonalFactor(mo.m, p.industry);
        const noise = 0.9 + 0.2*rand();
        const tpvMonth = p.baseTPV * growth * season * noise;
        const gross = tpvMonth * p.grossRate;
        const net   = tpvMonth * p.netRate;
        const netnet= tpvMonth * p.netNetRate;
        monthly[idx].tpv   += tpvMonth;
        monthly[idx].gross += gross;
        monthly[idx].net   += net;
        monthly[idx].netnet+= netnet;

        // Distribute into daily weights (slight weekday pattern + noise), normalized
        if(idx >= months12.length-4){
          const drec = daily[idx - (months12.length-4)];
          const dim = mo.dim;
          let weights = [];
          let sumw = 0;
          const phase = rand(0, Math.PI*2);
          for(let d=1; d<=dim; d++){
            const weekdayBoost = 1 + 0.15*Math.sin((2*Math.PI/7)*d + phase);
            const w = weekdayBoost * (0.9 + 0.2*rand());
            weights.push(w); sumw += w;
          }
          weights = weights.map(w=> w/sumw);
          for(let d=1; d<=dim; d++){
            const wp = weights[d-1];
            const t = tpvMonth * wp;
            drec.days[d-1].tpv   += t;
            drec.days[d-1].gross += t * p.grossRate;
            drec.days[d-1].net   += t * p.netRate;
            drec.days[d-1].netnet+= t * p.netNetRate;
          }
        }
      });
    });

    return { selectedCount: selected.length, months12, months4, monthly, daily };
  }

  function cumulative(arr){ const out=[]; let s=0; for(const v of arr){ s+=v; out.push(s); } return out; }
  function labelsDays(mo){ return Array.from({length:mo.dim}, (_,i)=> (i+1)); }
  function fmtMonth(m){ return monthShort(m.y, m.m); }

  // Build MTD traces for last 4 months for a metric field
  function buildMTDTraces(series, field){
    const today = new Date().getDate();
    const traces = [];
    series.months4.forEach((mo, i)=>{
      const rec = series.daily[i];
      const days = labelsDays(mo);
      const values = rec.days.map(d=> d[field]);
      const cumu = cumulative(values);
      const isCurrent = (mo.y===now.getFullYear() && mo.m===now.getMonth());
      const upto = isCurrent ? Math.min(today, days.length) : days.length;
      traces.push({
        type:'scatter', mode:'lines', name: fmtMonth(mo),
        x: days.slice(0,upto), y: cumu.slice(0,upto)
      });
    });
    return traces;
  }

  // Net revenue vs target: includes target & projection for current month
  function buildNetVsTarget(series){
    const traces = buildMTDTraces(series, 'net');
    // target for current month: prior month net * 1.08
    const idxCur = series.months4.length-1;
    const idxPrev = idxCur-1;
    const monthCur = series.months4[idxCur];
    const monthPrev = series.months4[idxPrev];
    const today = new Date().getDate();
    const dim = monthCur.dim;
    const prevNet = series.monthly[series.monthly.length-2].net;
    const target = prevNet * 1.08;
    // straight line to target
    const x = Array.from({length:today}, (_,i)=> i+1);
    const targetLine = x.map(d=> target * d/dim);
    traces.push({ type:'scatter', mode:'lines', name:'Target (cur mo.)', x, y:targetLine, line:{dash:'dash'} });

    // projection: based on current MTD pace × dim
    const curDaily = series.daily[idxCur].days.map(d=> d.net);
    const curCumu = cumulative(curDaily);
    const mtd = curCumu[Math.min(today, curCumu.length)-1] || 0;
    const proj = (mtd / Math.max(1, today)) * dim;
    const projLine = x.map(d=> proj * d/dim);
    traces.push({ type:'scatter', mode:'lines', name:'Projection (cur mo.)', x, y:projLine, line:{dash:'dot'} });

    return traces;
  }

  function layoutLine(yTitle){ return {
      paper_bgcolor:'white', plot_bgcolor:'white',
      margin:{l:70,r:20,t:10,b:44},
      xaxis:{ title:'Created day of month', gridcolor:'#eef2f7', zerolinecolor:'#cbd5e1', tickfont:{color:'#334155'}, titlefont:{color:'#334155'} },
      yaxis:{ title:yTitle, gridcolor:'#eef2f7', zerolinecolor:'#cbd5e1', tickprefix:'S$ ', separatethousands:true, tickfont:{color:'#334155'}, titlefont:{color:'#334155'} },
      legend:{orientation:'h', y:1.12, x:0, font:{color:'#0f172a'}}
    };
  }
  function layoutPercent(yTitle){ return {
      paper_bgcolor:'white', plot_bgcolor:'white',
      margin:{l:70,r:20,t:10,b:44},
      xaxis:{ title:'Month', gridcolor:'#eef2f7', zerolinecolor:'#cbd5e1', tickfont:{color:'#334155'}, titlefont:{color:'#334155'} },
      yaxis:{ title:yTitle, gridcolor:'#eef2f7', zerolinecolor:'#cbd5e1', tickformat:'.0%', tickfont:{color:'#334155'}, titlefont:{color:'#334155'} },
      legend:{orientation:'h', y:1.12, x:0, font:{color:'#0f172a'}}
    };
  }

  function draw(){
    if(!ensurePlotly()){ log('⚠️ Plotly not loaded.'); return; }
    const filters = getFilters();
    const series = buildSeries(filters);
    document.getElementById('matchCount').textContent = `${series.selectedCount.toLocaleString()} partners match`;
    const tzDate = new Date();
    document.getElementById('asOf').textContent = `As of ${tzDate.toLocaleDateString('en-SG',{year:'numeric',month:'long',day:'numeric'})}`;

    const hasData = series.selectedCount > 0;

    // A. Net revenue vs target
    {
      const el = document.getElementById('ch_net_vs_target');
      const empty = el.querySelector('.empty');
      if(!hasData){ empty.style.display='flex'; Plotly.purge(el); }
      else{
        empty.style.display='none';
        const traces = buildNetVsTarget(series);
        Plotly.react(el, traces, layoutLine('Cumulative Net Revenue (S$)'), {displayModeBar:true, responsive:true});
      }
    }

    // B–E: MTD cumulative for Gross, Net, Net Net, TPV
    const ids = [
      ['ch_gross_mtd','gross','Cumulative Gross Revenue (S$)'],
      ['ch_net_mtd','net','Cumulative Net Revenue (S$)'],
      ['ch_netnet_mtd','netnet','Cumulative Net Net Revenue (S$)'],
      ['ch_tpv_mtd','tpv','Cumulative TPV (S$)'],
    ];
    ids.forEach(([id, field, yT])=>{
      const el = document.getElementById(id);
      const empty = el.querySelector('.empty');
      if(!hasData){ empty.style.display='flex'; Plotly.purge(el); }
      else{
        empty.style.display='none';
        const traces = buildMTDTraces(series, field);
        Plotly.react(el, traces, layoutLine(yT), {displayModeBar:true, responsive:true});
      }
    });

    // F/G/H: Margins MTD and bar charts
    function monthLabels12(){ return series.months12.map(m=> monthShort(m.y,m.m)); }
    function barsForRatio(numField, denField){
      return series.months12.map((_, i)=>{
        const n = series.monthly[i][numField];
        const d = series.monthly[i][denField];
        return d>0 ? n/d : 0;
      });
    }
    function mtdMarginTraces(numField, denField){
      const traces = [];
      series.months4.forEach((mo, i)=>{
        const days = labelsDays(mo);
        const isCurrent = (mo.y===now.getFullYear() && mo.m===now.getMonth());
        const upto = isCurrent ? Math.min(days.length, new Date().getDate()) : days.length;
        const dn = series.daily[i].days.map(d=> d[numField]);
        const dd = series.daily[i].days.map(d=> d[denField]);
        const cn = cumulative(dn), cd = cumulative(dd);
        const mtd = cn.map((v,ix)=> cd[ix]>0 ? v/cd[ix] : 0);
        traces.push({ type:'scatter', mode:'lines', name: monthShort(mo.y,mo.m), x: days.slice(0,upto), y: mtd.slice(0,upto) });
      });
      return traces;
    }
    function drawBars(elId, vals, yTitle){
      const el = document.getElementById(elId);
      const empty = el.querySelector('.empty');
      if(!hasData){ empty.style.display='flex'; Plotly.purge(el); }
      else{
        empty.style.display='none';
        const trace = { type:'bar', name:yTitle, x: monthLabels12(), y: vals };
        Plotly.react(el, [trace], layoutPercent(yTitle), {displayModeBar:true, responsive:true});
      }
    }

    // Net Net margin (MTD line) removed by request
drawBars('ch_margin_netnet_bars', hasData ? barsForRatio('netnet','tpv') : [], 'Net Net Margin');

    // Net margin (MTD line) removed by request
drawBars('ch_margin_net_bars', hasData ? barsForRatio('net','tpv') : [], 'Net Margin');

    // Gross margin (MTD line) removed by request
drawBars('ch_margin_gross_bars', hasData ? barsForRatio('gross','tpv') : [], 'Gross Margin');

    if(diag) diag.style.display = 'none';
  }

  // UI hooks
  window.addEventListener('DOMContentLoaded', function(){
    const fb = document.getElementById('filtersBlock'); fb.open = false;
    document.getElementById('toggleFilters').addEventListener('click', ()=>{
      fb.open = !fb.open;
      document.getElementById('toggleFilters').textContent = fb.open ? 'Hide filters' : 'Show filters';
    });
    document.getElementById('resetBtn').addEventListener('click', ()=>{
      ['f_country','f_partnerCat','f_agreement','f_industry','f_cpm','f_product','f_lead','f_mkt','f_age'].forEach(id=> document.getElementById(id).selectedIndex = 0);
      draw();
    });
    ['f_country','f_partnerCat','f_agreement','f_industry','f_cpm','f_product','f_lead','f_mkt','f_age']
      .forEach(id=> document.getElementById(id).addEventListener('change', draw));

    draw();
  });
})();