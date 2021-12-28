var oXHR = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject('Microsoft.XMLHTTP');

    function reportStatus() {
        if (oXHR.readyState == 4)               // REQUEST COMPLETED.
            showTheList(this.responseXML);      // ALL SET. NOW SHOW XML DATA.
		else
			document.getElementById("demo").innerHTML="Error?";
    }

    oXHR.onreadystatechange = reportStatus;
    oXHR.open("GET", "C:\College Stuff\Projects\MysticMemoirsWebsite\race-dwarf.xml", true);      // true = ASYNCHRONOUS REQUEST (DESIRABLE), false = SYNCHRONOUS REQUEST.
    oXHR.send();

    function showTheList(xml) {
		var description=xml.getElementsByTagName('description')[0].childNodes[0].nodeValue;
        document.getElementById("demo").innerHTML=description;
    };