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
		document.getElementById("trial").innerHTML='<button type="button" id="race" onclick="location.href=\'Race.html\'" class="mainSelectionButtons">Race</button> <button type="button" id="class" onclick="location.href=\'Class.html\'" class="mainSelectionButtons">Class</button><button type="button" id="background "onclick="location.href=\'Background.html\'" class="mainSelectionButtons">Background</button>';
	}