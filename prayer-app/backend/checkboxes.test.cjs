const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
let values,rules,writes,submissions=0;
const checkbox={getCriteriaType:()=> 'CHECKBOX'};
const sheet={getName:()=> 'Manual Entry',getRange:(row,col)=>{
 if(row==='B7:B9')return {getValues:()=>values.map(v=>[v]),getDataValidations:()=>rules.map(v=>[v])};
 return {setDataValidation:rule=>{rules[row-7]=rule;writes.push(['rule',row]);},setValue:value=>{values[row-7]=value;writes.push(['value',row,value]);}};
}};
const ctx={SpreadsheetApp:{DataValidationCriteria:{CHECKBOX:'CHECKBOX'},newDataValidation:()=>({requireCheckbox(){return this},setAllowInvalid(){return this},build(){return checkbox}})},hubHandleEdit_:()=>{}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/Code.gs','utf8'),ctx);
const event={range:{getSheet:()=>sheet,getNumRows:()=>1,getNumColumns:()=>1,getRow:()=>9,getColumn:()=>2,getValue:()=>values[2]}};
ctx.saveManualRequest_=()=>{submissions++;};
values=[true,'',false];rules=[checkbox,null,checkbox];writes=[];ctx.repairManualCheckboxes_(event);
assert.deepEqual(values,[true,false,false]);assert.equal(writes.length,2);assert.equal(writes[0][1],8);
values=[false,false,''];rules=[checkbox,checkbox,null];writes=[];ctx.onEdit(event);
assert.equal(values[2],false);assert.equal(submissions,0);
values=[true,true,false];rules=[checkbox,checkbox,checkbox];writes=[];ctx.repairManualCheckboxes_(event);assert.equal(writes.length,0);assert.deepEqual(values,[true,true,false]);
values=['','not a checkbox',''];rules=[null,null,null];writes=[];ctx.repairManualCheckboxes_(event);assert.deepEqual(values,[false,false,false]);
// A real checked submit control is left for the existing submission handler.
values=[false,false,true];rules=[checkbox,checkbox,checkbox];writes=[];ctx.repairManualCheckboxes_(event);assert.equal(values[2],true);assert.equal(writes.length,0);
console.log('PASS: deleted controls restore unchecked, consent and valid ticks are preserved, clearing Submit never submits, normal Submit stays checked.');
