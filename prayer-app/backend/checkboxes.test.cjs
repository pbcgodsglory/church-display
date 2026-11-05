const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const checkbox={getCriteriaType:()=> 'CHECKBOX'},cells=new Map();
let writes=0,submissions=0;
const key=(r,c)=>r+','+c;
for(let r=6;r<=30;r++)for(let c=5;c<=6;c++)cells.set(key(r,c),{value:false,rule:checkbox});
cells.set('3,2',{value:false,rule:checkbox});
const sheet={getName:()=> 'Manual Entry',getRange:(r,c,n=1,w=1)=>{
 if(r==='A5')return {getValue:()=> 'Requested By'};
 return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>cells.get(key(r+i,c+j)).value)),
 getDataValidations:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>cells.get(key(r+i,c+j)).rule)),
 setDataValidation:rule=>{cells.get(key(r,c)).rule=rule;writes++},
 setValue:value=>{cells.get(key(r,c)).value=value;writes++}};
}};
const ctx={SpreadsheetApp:{DataValidationCriteria:{CHECKBOX:'CHECKBOX'},newDataValidation:()=>({requireCheckbox(){return this},setAllowInvalid(){return this},build(){return checkbox}})},hubHandleEdit_:()=>{},signupHandleEdit_:()=>{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/Code.gs','utf8'),ctx);
const event={range:{getSheet:()=>sheet,getNumRows:()=>1,getNumColumns:()=>1,getRow:()=>3,getColumn:()=>2,getValue:()=>cells.get('3,2').value}};
ctx.saveManualRequest_=()=>submissions++;
cells.set('6,6',{value:'',rule:null});cells.get('7,5').value=true;
ctx.repairManualCheckboxes_(event);assert.equal(cells.get('6,6').value,false);assert.equal(cells.get('7,5').value,true);assert.equal(writes,2);
cells.set('3,2',{value:'',rule:null});ctx.onEdit(event);assert.equal(cells.get('3,2').value,false);assert.equal(submissions,0);
cells.get('3,2').value=true;writes=0;ctx.repairManualCheckboxes_(event);assert.equal(writes,0);assert.equal(cells.get('3,2').value,true);
console.log('PASS: batch checkboxes restore unchecked; valid ticks remain; clearing Submit never submits.');
