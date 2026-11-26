(()=>{
'use strict';
const form=document.getElementById('contact-form'),message=document.getElementById('contact-message');
message.addEventListener('input',()=>message.setCustomValidity(''));
form.addEventListener('submit',event=>{
 event.preventDefault();
 const text=message.value.trim();
 message.setCustomValidity(text?'':'Please write a message.');
 if(!form.reportValidity())return;
 const name=document.getElementById('contact-name').value.trim();
 const body=[document.getElementById('contact-type').value,name?'From: '+name:'',text].filter(Boolean).join('\r\n\r\n');
 window.location.href='mailto:peruachar16@gmail.com?subject=Aroha&body='+encodeURIComponent(body);
 document.getElementById('contact-status').textContent='Email draft requested with your message filled in. Review it and press Send in your email app. If the app did not open, use the email address below; your message has been kept here.';
});
})();
