import {safeURL} from './city-model.js';

export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function livePreviewURL(project) {
  return project.delivery_mode==='github_only'?null:safeURL(project.live,false);
}

function actions(project,detail=false) {
  const live=livePreviewURL(project),source=safeURL(project.source,false),walkthrough=safeURL(project.walkthrough);
  return `<div class="lab-links">${live?`<a href="${esc(live)}" target="_blank" rel="noopener">${detail?'Open working demo':'Open live project'} ↗</a>`:''}${source?`<a href="${esc(source)}" target="_blank" rel="noopener">${project.research?'Research source':detail?'Read code and verification':'Source'} ↗</a>`:''}${walkthrough?`<a href="${esc(walkthrough)}"${walkthrough.startsWith('https:')?' target="_blank" rel="noopener"':''}>${project.research?'Research guide':'Project walkthrough'} ↗</a>`:''}</div>`;
}

function status(project) {
  return project.delivery_mode==='github_only'?`<span class="project-delivery">${project.research?'Research notebooks · GitHub':'Code-only project · GitHub'}</span>`:'';
}

function cover(project,detail=false) {
  const url=safeURL(project.cover);
  return url?`<img src="${esc(url)}" ${detail?'class="dialog-cover"':'loading="lazy"'} width="600" height="350" alt="${esc(project.visual||project.title)}">`:'';
}

export function archiveCard(project) {
  return `<article class="project-card lab-card ${esc(project.theme)}"><button class="lab-visual" data-preview="${esc(project.slug)}" aria-label="Explore ${esc(project.title)}">${cover(project)}<span class="preview-prompt">${project.research?'Explore the research':'Inspect the workflow'} +</span></button><div class="project-info"><span class="mono muted">${esc(project.date)} / ${esc(project.domain)}</span><h3>${esc(project.title)}</h3><p>${esc(project.description)}</p><div class="tags">${project.stack.map(s=>`<span>${esc(s)}</span>`).join('')}</div>${status(project)}${actions(project)}</div></article>`;
}

export function archiveDetails(project) {
  const live=livePreviewURL(project);
  return `<p class="eyebrow">${esc(project.domain)} / ${esc(project.date)}</p><h2 id="archive-dialog-title">${esc(project.title)}</h2><p>${esc(project.details)}</p>${cover(project,true)}${status(project)}${actions(project,true)}${live&&project.embed!==false?'<button id="load-live-preview" class="project-details">Load interactive live preview +</button><div id="live-preview"></div>':''}`;
}
