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
		document.write('<button type="button" onclick="Race.html" class="mainSelectionButtons">Race</button> <button type="button" onclick="Class.html" class="mainSelectionButtons">Class</button><button type="button" onclick="Background.html" class="mainSelectionButtons">Background</button>');
	}