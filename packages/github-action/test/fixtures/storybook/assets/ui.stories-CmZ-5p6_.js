import{j as e}from"./iframe-LMWW3cHV.js";import"./preload-helper-Dp1pzeXC.js";function P(a){return a===null?"—":`${(Math.floor(a*10+1e-9)/10).toFixed(1)}%`}function q(a){return a===null?"muted":a>=90?"good":a>=75?"ok":a>=60?"warn":"bad"}function i({children:a,className:r=""}){return e.jsx("div",{className:`flex flex-col rounded-xl border border-(--border) bg-(--surface) shadow-[0_1px_2px_rgba(0,0,0,.04)] ${r}`,children:a})}function x({title:a,description:r,action:t}){return e.jsxs("div",{className:"flex items-start justify-between gap-3 px-5 pt-4 pb-3",children:[e.jsxs("div",{children:[e.jsx("div",{className:"text-[13.5px] font-semibold tracking-tight",children:a}),r&&e.jsx("div",{className:"mt-0.5 text-xs text-(--muted)",children:r})]}),t]})}function R({children:a}){return e.jsx("div",{className:"mt-auto border-t border-(--hairline) px-5 py-2.5 text-xs text-(--muted)",children:a})}const I={good:"bg-(--good)",ok:"bg-(--ok)",warn:"bg-(--warn)",bad:"bg-(--bad)",muted:"bg-(--muted)"},F={good:"bg-(--good-track)",ok:"bg-(--ok-track)",warn:"bg-(--warn-track)",bad:"bg-(--bad-track)",muted:"bg-(--surface-2)"},H={good:"text-(--good)",ok:"text-(--ok)",warn:"text-(--warn)",bad:"text-(--bad)",muted:"text-(--muted)"};function $({percent:a,className:r="",label:t="Coverage"}){const l=q(a),D=a===null?0:Math.max(a,2);return e.jsx("div",{className:`h-1.5 overflow-hidden rounded-full ${F[l]} ${r}`,role:"meter","aria-label":t,"aria-valuenow":a??0,"aria-valuemin":0,"aria-valuemax":100,children:e.jsx("div",{className:`h-full rounded-full transition-[width] duration-500 ${I[l]}`,style:{width:`${D}%`}})})}function h({percent:a,className:r=""}){return e.jsx("span",{className:`font-semibold tabular-nums ${H[q(a)]} ${r}`,children:P(a)})}function b({current:a,previous:r}){if(a===null||r===null||r===void 0)return null;const t=a-r;if(Math.abs(t)<.05)return e.jsx("span",{className:"rounded-full bg-(--surface-2) px-2.5 py-0.5 text-xs font-semibold tracking-normal whitespace-nowrap text-(--muted)",children:"— steady"});const l=t>0;return e.jsxs("span",{className:`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-normal whitespace-nowrap ${l?"bg-(--chip-up-bg) text-(--chip-up)":"bg-(--chip-down-bg) text-(--chip-down)"}`,children:[l?"▲":"▼"," ",Math.abs(t).toFixed(1),"%"]})}function n({value:a,label:r}){return e.jsxs("div",{children:[e.jsx("div",{className:"text-xl font-semibold tracking-tight",children:a}),e.jsx("div",{className:"mt-0.5 text-xs text-(--muted)",children:r})]})}function p({children:a,right:r=!1}){return e.jsx("th",{className:`px-4 pb-2.5 text-xs font-medium tracking-wide text-(--muted) uppercase ${r?"text-right":"text-left"}`,children:a})}function s({children:a,className:r=""}){return e.jsx("td",{className:`border-t border-(--hairline) px-4 py-2.5 ${r}`,children:a})}function d({branch:a,pr:r}){const t=!r&&(a==="main"||a==="master");return e.jsx("span",{title:t?"Default branch":"Not the default branch",className:`inline-block max-w-full truncate rounded-full border px-2 py-0.5 align-middle font-mono text-[11px] ${t?"border-(--hairline) bg-(--surface-2) text-(--ink-2)":"border-(--warn) text-(--warn)"}`,children:r?`PR #${r}`:a})}i.__docgenInfo={description:"",methods:[],displayName:"Card",props:{children:{required:!0,tsType:{name:"ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'""',computed:!1}}}};x.__docgenInfo={description:"",methods:[],displayName:"CardHeader",props:{title:{required:!0,tsType:{name:"ReactNode"},description:""},description:{required:!1,tsType:{name:"ReactNode"},description:""},action:{required:!1,tsType:{name:"ReactNode"},description:""}}};R.__docgenInfo={description:"",methods:[],displayName:"CardFooter",props:{children:{required:!0,tsType:{name:"ReactNode"},description:""}}};$.__docgenInfo={description:"Severity meter: fill carries state, track is a lighter step of the same ramp.",methods:[],displayName:"Meter",props:{percent:{required:!0,tsType:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}]},description:""},className:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'""',computed:!1}},label:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'"Coverage"',computed:!1}}}};h.__docgenInfo={description:"",methods:[],displayName:"Pct",props:{percent:{required:!0,tsType:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}]},description:""},className:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'""',computed:!1}}}};b.__docgenInfo={description:"Delta vs the previous upload: a small direction chip.",methods:[],displayName:"DeltaChip",props:{current:{required:!0,tsType:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}]},description:""},previous:{required:!0,tsType:{name:"union",raw:"number | null | undefined",elements:[{name:"number"},{name:"null"},{name:"undefined"}]},description:""}}};n.__docgenInfo={description:"",methods:[],displayName:"Stat",props:{value:{required:!0,tsType:{name:"ReactNode"},description:""},label:{required:!0,tsType:{name:"string"},description:""}}};p.__docgenInfo={description:"",methods:[],displayName:"Th",props:{children:{required:!1,tsType:{name:"ReactNode"},description:""},right:{required:!1,tsType:{name:"boolean"},description:"",defaultValue:{value:"false",computed:!1}}}};s.__docgenInfo={description:"",methods:[],displayName:"Td",props:{children:{required:!1,tsType:{name:"ReactNode"},description:""},className:{required:!1,tsType:{name:"string"},description:"",defaultValue:{value:'""',computed:!1}}}};d.__docgenInfo={description:`A branch/PR pill. The default branch (main/master) reads neutral; a PR or any
other branch reads amber — so "is this main?" is answerable at a glance.`,methods:[],displayName:"BranchTag",props:{branch:{required:!0,tsType:{name:"string"},description:""},pr:{required:!1,tsType:{name:"union",raw:"number | null",elements:[{name:"number"},{name:"null"}]},description:""}}};const M={title:"Design system/Dashboard primitives",tags:["autodocs"]},o={render:()=>e.jsxs(i,{children:[e.jsx(x,{title:"Coverage health",description:"The complete semantic color range used throughout Covallaby."}),e.jsx("div",{className:"grid gap-5 px-5 pb-5 sm:grid-cols-2",children:[["Excellent",96.4],["Healthy",83.2],["Needs attention",67.5],["At risk",42.1]].map(([a,r])=>e.jsxs("div",{children:[e.jsxs("div",{className:"mb-2 flex items-center justify-between text-sm",children:[e.jsx("span",{children:a}),e.jsx(h,{percent:Number(r)})]}),e.jsx($,{percent:Number(r),label:`${a} coverage`})]},a))}),e.jsx(R,{children:"Colors communicate status consistently in light and dark themes."})]})},c={render:()=>e.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[e.jsx(i,{className:"p-5",children:e.jsxs("div",{className:"grid grid-cols-2 gap-5",children:[e.jsx(n,{value:e.jsx("span",{className:"text-(--good)",children:"88.7%"}),label:"Line coverage"}),e.jsx(n,{value:"142",label:"Files measured"}),e.jsx(n,{value:e.jsx(b,{current:88.7,previous:86.2}),label:"Since previous"}),e.jsx(n,{value:e.jsx(d,{branch:"main"}),label:"Current branch"})]})}),e.jsx(i,{className:"p-5",children:e.jsxs("div",{className:"grid grid-cols-2 gap-5",children:[e.jsx(n,{value:e.jsx("span",{className:"text-(--warn)",children:"72.4%"}),label:"Patch coverage"}),e.jsx(n,{value:"9",label:"Changed files"}),e.jsx(n,{value:e.jsx(b,{current:72.4,previous:79.1}),label:"Since previous"}),e.jsx(n,{value:e.jsx(d,{branch:"feature/previews",pr:24}),label:"Pull request"})]})})]})},u={render:()=>e.jsxs(i,{children:[e.jsx(x,{title:"Recent uploads",description:"Dense data remains calm and scannable."}),e.jsxs("table",{className:"w-full text-[13.5px]",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx(p,{children:"Repository"}),e.jsx(p,{children:"Branch"}),e.jsx(p,{right:!0,children:"Coverage"})]})}),e.jsxs("tbody",{children:[e.jsxs("tr",{children:[e.jsx(s,{children:"covallaby/action"}),e.jsx(s,{children:e.jsx(d,{branch:"main"})}),e.jsx(s,{className:"text-right",children:e.jsx(h,{percent:91.2})})]}),e.jsxs("tr",{children:[e.jsx(s,{children:"covallaby/covallaby"}),e.jsx(s,{children:e.jsx(d,{branch:"storybook-dogfood",pr:7})}),e.jsx(s,{className:"text-right",children:e.jsx(h,{percent:79.8})})]})]})]})]})},m={render:()=>e.jsxs(i,{children:[e.jsx(x,{title:"Storybook previews",description:"Explore the exact component library built by CI."}),e.jsx("div",{className:"px-5 pb-6 text-sm text-(--muted)",children:"No previews yet. Upload a Storybook build with the Covallaby Action to publish the first one."})]})};var g,f,v;o.parameters={...o.parameters,docs:{...(g=o.parameters)==null?void 0:g.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader title="Coverage health" description="The complete semantic color range used throughout Covallaby." />
      <div className="grid gap-5 px-5 pb-5 sm:grid-cols-2">
        {[["Excellent", 96.4], ["Healthy", 83.2], ["Needs attention", 67.5], ["At risk", 42.1]].map(([label, value]) => <div key={label}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span>{label}</span>
              <Pct percent={Number(value)} />
            </div>
            <Meter percent={Number(value)} label={\`\${label} coverage\`} />
          </div>)}
      </div>
      <CardFooter>Colors communicate status consistently in light and dark themes.</CardFooter>
    </Card>
}`,...(v=(f=o.parameters)==null?void 0:f.docs)==null?void 0:v.source}}};var y,j,N;c.parameters={...c.parameters,docs:{...(y=c.parameters)==null?void 0:y.docs,source:{originalSource:`{
  render: () => <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-5">
          <Stat value={<span className="text-(--good)">88.7%</span>} label="Line coverage" />
          <Stat value="142" label="Files measured" />
          <Stat value={<DeltaChip current={88.7} previous={86.2} />} label="Since previous" />
          <Stat value={<BranchTag branch="main" />} label="Current branch" />
        </div>
      </Card>
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-5">
          <Stat value={<span className="text-(--warn)">72.4%</span>} label="Patch coverage" />
          <Stat value="9" label="Changed files" />
          <Stat value={<DeltaChip current={72.4} previous={79.1} />} label="Since previous" />
          <Stat value={<BranchTag branch="feature/previews" pr={24} />} label="Pull request" />
        </div>
      </Card>
    </div>
}`,...(N=(j=c.parameters)==null?void 0:j.docs)==null?void 0:N.source}}};var T,C,w;u.parameters={...u.parameters,docs:{...(T=u.parameters)==null?void 0:T.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader title="Recent uploads" description="Dense data remains calm and scannable." />
      <table className="w-full text-[13.5px]">
        <thead>
          <tr>
            <Th>Repository</Th>
            <Th>Branch</Th>
            <Th right>Coverage</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>covallaby/action</Td>
            <Td>
              <BranchTag branch="main" />
            </Td>
            <Td className="text-right">
              <Pct percent={91.2} />
            </Td>
          </tr>
          <tr>
            <Td>covallaby/covallaby</Td>
            <Td>
              <BranchTag branch="storybook-dogfood" pr={7} />
            </Td>
            <Td className="text-right">
              <Pct percent={79.8} />
            </Td>
          </tr>
        </tbody>
      </table>
    </Card>
}`,...(w=(C=u.parameters)==null?void 0:C.docs)==null?void 0:w.source}}};var k,S,_;m.parameters={...m.parameters,docs:{...(k=m.parameters)==null?void 0:k.docs,source:{originalSource:`{
  render: () => <Card>
      <CardHeader title="Storybook previews" description="Explore the exact component library built by CI." />
      <div className="px-5 pb-6 text-sm text-(--muted)">
        No previews yet. Upload a Storybook build with the Covallaby Action to publish the first
        one.
      </div>
    </Card>
}`,...(_=(S=m.parameters)==null?void 0:S.docs)==null?void 0:_.source}}};const V=["CoverageHealth","RepositorySummary","DataTable","EmptyState"];export{o as CoverageHealth,u as DataTable,m as EmptyState,c as RepositorySummary,V as __namedExportsOrder,M as default};
