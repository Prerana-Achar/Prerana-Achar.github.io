   
 function reportStatus()
	{
		
        if (oXHR.readyState == 4)               // REQUEST COMPLETED.
            showTheList(this.responseXML);      // ALL SET. NOW SHOW XML DATA.
    }
	
	function loadXML(path)
	{
		var oXHR = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');
		oXHR.onreadystatechange = reportStatus;
		oXHR.open("GET", path, true);        // true = ASYNCHRONOUS REQUEST (DESIRABLE), false = SYNCHRONOUS REQUEST.
		oXHR.send();
	}
    

    function showTheList(xml,id) {

        var divInfo = document.getElementById(id);        // THE PARENT DIV.
        
    }

	function writeMainHeader()
	{
		document.getElementById("trial").innerHTML='<button type="button" id="race" onclick="location.href=\'Race.html\'" class="mainSelectionButtons">Race</button><button type="button" id="class" onclick="location.href=\'Class.html\'" class="mainSelectionButtons">Class</button><button type="button" id="background" onclick="location.href=\'Background.html\'" class="mainSelectionButtons">Background</button><HeaderImage style="top:30px;"></HeaderImage><HeaderImage style="bottom:10px;"></HeaderImage>';
	}
	
    function writeInfo()
    {
	var node = document.getElementById('info_viewer');
	var info_header=document.createElement('p');
	info_header.setAttribute=('id','description_heading');
	info_header.style.textDecoration="underline";
	info_header.style.fontSize="18px";
	info_header.textContent="Text";
	node.appendChild(info_header);

	var info_content=document.createElement('p');
	info_content.setAttribute=('id','description_content');
	info_content.style.marginTop="-15px";
	info_content.style.marginLeft="30px";
	info_content.textContent="Text";
	node.appendChild(info_content);
	
	var line=document.createElement('hr');
	line.setAttribute('id','line');
	node.appendChild(line);
	
    }