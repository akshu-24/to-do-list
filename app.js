class TaskManager{
  constructor(){
    this.storageKey='adv_todo_v1';
    this.tasks=[];this.history=[];this.future=[];this.dragSrc=null;
    this.load();
    this.bind();
    this.render();
  }
  bind(){
    this.$=sel=>document.querySelector(sel);
    this.list=this.$('#task-list');
    this.template=document.getElementById('task-template');
    this.form=document.getElementById('task-form');
    this.formTitle=this.$('#form-title');
    this.editId=null;

    document.getElementById('open-add').addEventListener('click',()=>this.openAdd());
    document.getElementById('quick-title').addEventListener('keydown',e=>{if(e.key==='Enter'){this.addQuick();}});
    this.form.addEventListener('submit',e=>{e.preventDefault();this.saveFromForm();});
    this.$('#cancel-edit').addEventListener('click',()=>this.closeForm());

    this.$('#search').addEventListener('input',()=>this.render());
    this.$('#status-filter').addEventListener('change',()=>this.render());
    this.$('#sort-by').addEventListener('change',()=>this.render());
    this.$('#tag-filter').addEventListener('input',()=>this.render());

    this.$('#clear-completed').addEventListener('click',()=>{this.pushHistory();this.tasks=this.tasks.filter(t=>!t.done);this.save();this.render();});
    this.$('#export-json').addEventListener('click',()=>this.export());
    this.$('#import-json').addEventListener('click',()=>this.importPrompt());

    document.addEventListener('keydown',e=>{
      if(e.key==='n' || e.key==='N'){this.$('#title').focus();}
      if(e.key==='f' || e.key==='F'){this.$('#search').focus();}
      if((e.ctrlKey||e.metaKey)&&e.key==='z'){this.undo();}
      if((e.ctrlKey||e.metaKey)&&e.key==='y'){this.redo();}
      if(e.key==='U'){this.undo();}
      if(e.key==='R'){this.redo();}
    });
  }
  pushHistory(){this.history.push(JSON.stringify(this.tasks)); if(this.history.length>200) this.history.shift(); this.future=[]}
  undo(){if(!this.history.length) return; this.future.push(JSON.stringify(this.tasks)); this.tasks=JSON.parse(this.history.pop()); this.save(); this.render();}
  redo(){if(!this.future.length) return; this.history.push(JSON.stringify(this.tasks)); this.tasks=JSON.parse(this.future.pop()); this.save(); this.render();}

  addQuick(){const t=this.$('#quick-title'); if(!t.value.trim()) return; this.pushHistory(); this.tasks.unshift(this._makeTask({title:t.value.trim()})); t.value=''; this.save(); this.render();}
  openAdd(){this.editId=null;this.formTitle.textContent='Add Task';this.form.reset();this.$('#title').focus();}
  openEdit(id){this.editId=id;const task=this.tasks.find(t=>t.id===id); if(!task) return; this.formTitle.textContent='Edit Task'; this.$('#title').value=task.title; this.$('#description').value=task.description||''; this.$('#due').value=task.due||''; this.$('#priority').value=task.priority||'medium'; this.$('#tags').value=(task.tags||[]).join(',');}
  closeForm(){this.form.reset();this.editId=null}

  saveFromForm(){const data={title:this.$('#title').value.trim(),description:this.$('#description').value,priority:this.$('#priority').value,due:this.$('#due').value,tags:this.$('#tags').value.split(',').map(s=>s.trim()).filter(Boolean)}; if(!data.title) return alert('Title required'); this.pushHistory(); if(this.editId){const idx=this.tasks.findIndex(t=>t.id===this.editId); Object.assign(this.tasks[idx],data);} else {this.tasks.unshift(this._makeTask(data));} this.save(); this.render(); this.closeForm();}

  _makeTask(data){return Object.assign({id:crypto.randomUUID(),title:'',description:'',done:false,created:new Date().toISOString(),order:this.tasks.length},data);}

  save(){localStorage.setItem(this.storageKey,JSON.stringify(this.tasks));}
  load(){try{const raw=localStorage.getItem(this.storageKey); this.tasks=raw?JSON.parse(raw):[];}catch(e){this.tasks=[]}}

  render(){this.list.innerHTML='';
    const q=this.$('#search').value.toLowerCase(); const status=this.$('#status-filter').value; const tagFilter=this.$('#tag-filter').value.toLowerCase();
    let items=[...this.tasks];
    const sort=this.$('#sort-by').value;
    if(sort==='due') items.sort((a,b)=> (a.due||'') > (b.due||'') ? 1:-1);
    if(sort==='priority') items.sort((a,b)=> ['low','medium','high'].indexOf(a.priority) - ['low','medium','high'].indexOf(b.priority));
    if(sort==='created') items.sort((a,b)=> new Date(b.created)-new Date(a.created));
    if(sort==='order') items.sort((a,b)=> (a.order||0)-(b.order||0));

    items=items.filter(t=>{
      if(status==='active' && t.done) return false; if(status==='done' && !t.done) return false;
      if(q && !(t.title.toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q))) return false;
      if(tagFilter){ if(!(t.tags||[]).map(x=>x.toLowerCase()).includes(tagFilter)) return false; }
      return true;
    });

    for(const task of items){const node=this.template.content.cloneNode(true); const li=node.querySelector('li'); li.dataset.id=task.id; li.querySelector('.title').textContent=task.title; li.querySelector('.sub .tags').textContent=(task.tags||[]).join(' '); li.querySelector('.sub .due').textContent=task.due?(' • due '+task.due):''; li.querySelector('.priority').textContent=task.priority; li.querySelector('.priority').dataset.p=task.priority; const chk=li.querySelector('.toggle'); chk.checked=!!task.done; if(task.done) li.classList.add('done');
      li.querySelector('.edit').addEventListener('click',()=>this.openEdit(task.id));
      li.querySelector('.delete').addEventListener('click',()=>{this.pushHistory(); this.tasks=this.tasks.filter(t=>t.id!==task.id); this.save(); this.render();});
      chk.addEventListener('change',e=>{this.pushHistory(); task.done=e.target.checked; this.save(); this.render();});

      // drag handlers
      li.addEventListener('dragstart',e=>{this.dragSrc=task.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed='move'});
      li.addEventListener('dragend',()=>{li.classList.remove('dragging'); this.dragSrc=null});
      li.addEventListener('dragover',e=>{e.preventDefault(); e.dataTransfer.dropEffect='move'});
      li.addEventListener('drop',e=>{e.preventDefault(); const dstId=li.dataset.id; if(this.dragSrc && this.dragSrc!==dstId){this.pushHistory(); this._reorder(this.dragSrc,dstId); this.save(); this.render();}});

      this.list.appendChild(node);
    }
  }

  _reorder(srcId,dstId){const srcIndex=this.tasks.findIndex(t=>t.id===srcId); const dstIndex=this.tasks.findIndex(t=>t.id===dstId); if(srcIndex<0||dstIndex<0) return; const [item]=this.tasks.splice(srcIndex,1); this.tasks.splice(dstIndex,0,item); this.tasks.forEach((t,i)=>t.order=i);}

  export(){const data=JSON.stringify(this.tasks,null,2); const blob=new Blob([data],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='tasks.json'; a.click(); URL.revokeObjectURL(url);} 
  importPrompt(){const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange=async e=>{const f=e.target.files[0]; if(!f) return; const text=await f.text(); try{const parsed=JSON.parse(text); if(!Array.isArray(parsed)) throw new Error('Invalid'); this.pushHistory(); this.tasks=parsed; this.save(); this.render();}catch(err){alert('Invalid JSON file');}}; inp.click();}
}

window.addEventListener('DOMContentLoaded',()=>window.app=new TaskManager());
