(function(){
  var app = angular.module('hdami_module', []);

  var BLOOD_DENSITY	    = 1060;   //	Kg/m3
  var ETHANOL_DENSITY       = 0.78924;//	Kg/L
  var ETHANOL_OUPUT_RATE_MG = 12;     //	mg/hour
  
  var ETHANOL_OUTPUT_RATE_ML=ETHANOL_OUPUT_RATE_MG/ETHANOL_DENSITY;		
  var MS_PER_HOUR = 1000 * 60 * 60;
 
    
  app.controller('myCtrl', function($scope, $interval){
  
    this.person = person;
    this.person.state = dump(this.person.pcBAC);    
    this.person.prevUpdateTime = new Date();

    $scope.updateBAC = function(p, now, mL_in){ 
      	  n = p.drinks.length;
	  if ((n > 0) && (p.weight != undefined)){
            var hr = Math.abs(now - p.prevUpdateTime) / MS_PER_HOUR;            
            
            //output
            var mL_out = ETHANOL_OUTPUT_RATE_ML * hr;

            p.NettmL += mL_in- mL_out;              
            if (p.NettmL < 0) p.NettmL = 0;            

            p.pcBAC = (p.NettmL * ETHANOL_DENSITY )/ (10 * p.weight);
            p.state = dump(p.pcBAC);
            var newBAC = Math.round((p.NettmL * ETHANOL_DENSITY ) / ((8*p.weight)/1060),1); 
            if (p.BAC != newBAC) {
              p.BAC = newBAC;
              addPoint(now, p.BAC);           
            }
          }
          p.prevUpdateTime = now;
          localStorage["person"]  = JSON.stringify(p);
    }
        
    $scope.abvOptions = [];
    for (i=3.0; i<6; i=i+0.1){
      var v = Math.round(i*10)/10;
      $scope.abvOptions.push({ name: v+'%', value: v });
    }
    $scope.formABV = $scope.abvOptions[10].value;
    
    $scope.drinkOptions = [
      { name: 'Pint', value: '568' }, 
      { name: '500mL Bottle', value: '500' }, 
      { name: '330mL Bottle', value: '330' }, 
    ];    
    $scope.formML = $scope.drinkOptions[0].value;

    $scope.weightOptions = [];
    for(var i=60;i<151;i++){
         $scope.weightOptions.push({ name: i+' Kg', value: i });
    }
    $scope.formWeight = $scope.weightOptions[72-60].value;
          
    $scope.callAtInterval = function(p) {
      var now = new Date();
      //Assume 1 drink every 30 mins
      var DRINKS_PER_HOUR = 2;
      var mL_in = 0;
      if (!p.stopped) {
        n = p.drinks.length;
        if (n > 0){              
 	  var hr = Math.abs(now - p.prevUpdateTime) / MS_PER_HOUR; 	  
 	  var numDrinks = hr * DRINKS_PER_HOUR;
 	  if (numDrinks >= 1){
 	    p.stopped = true;
 	  }else{ 	  
       	    mL_in  = numDrinks * p.drinks[n-1].mL * ETHANOL_DENSITY * (p.drinks[n-1].abv / 100);     	  
       	  }
   	}
      }
      $scope.updateBAC(p, now, mL_in);          
    }

    $scope.drinkStart = function(p){
          if (p.weight != undefined){        
            var now = new Date();
     	    $scope.drinkStop(p);

            //find drink name
            var drink = $scope.drinkOptions.reduce(function(a, b) {
              if (a.value == $scope.formML){             
                return a;
              }else{
                return b;
              }              
            });
            
            //start another       
            p.drinks.push({
            	startTime:	now, 
            	abv:		parseFloat($scope.formABV), 
            	startBAC:	BAC(p.NettmL,p.weight), 
            	mL:		parseInt(drink.value), 
            	name:		drink.name});
            
            p.stopped = false;
            p.startmL = p.NettmL;
          }
          else { //set weight
          }
    }    
  
    $scope.drinkStop = function(p){
     	  if (!p.stopped) {
            var now = new Date();
	    n = p.drinks.length;
	    if (n > 0){
   	      p.drinks[n-1].endTime = now;
   	      var mL = abv2ml(p.drinks[n-1].mL, p.drinks[n-1].abv)-(p.NettmL-p.startmL);
   	      $scope.updateBAC(p,now, mL);        
   	      p.drinks[n-1].endBAC = p.BAC;
   	    }
   	  }
          p.stopped = true;
    } 

    $scope.reset = function(p){
      if (p){
    	  p.drinks = [];
        p.stopped = true;
        p.BAC = 0;
        p.pcBAC = 0;
        p.NettmL = 0;
        p.startmL = p.NettmL;
        p.state = dump(p.pcBAC);    
        p.prevUpdateTime = new Date();
        $scope.alias.person = p;
      }
      initChart('reset');
      localStorage.clear();
    } 
  

    $interval( function(){ 
      $scope.callAtInterval($scope.alias.person); 
    }, 10*1000);


    if (localStorage["person"]) {  
              
        initChart('local');
        this.person = JSON.parse(localStorage["person"]);
        if (this.person){
          this.person.prevUpdateTime = new Date(this.person.prevUpdateTime);
        
          for (var i=0; i<this.person.drinks.length; i++) {
            this.person.drinks[i].startTime = new Date(this.person.drinks[i].startTime);   
            addPoint(this.person.drinks[i].startTime, this.person.drinks[i].startBAC);
          }
        }
    } else {
      initChart('no local');
    }                           
  });
 
  function BAC(mL, weight){
    return Math.round((mL * ETHANOL_DENSITY ) / ((8*weight)/1060),1);            
  }
  
  function abv2ml(mL, abv)
  {
     return (mL * ETHANOL_DENSITY * abv / 100);
  }
        
  var person = {
  	weight:72,
  	pcBAC:0,
  	BAC:0,
 	NettmL:0,
        prevUpdateTime:undefined,
        drinks:[],
        stopped:true,
        startmL:0,                 	                 
  };

  function dump(bac){
    if (bac <= 0.02) {
      return "Stone cold sober.";
    }else if (bac <= 0.04) {
      return "No loss of coordination. Slight euphoria, mildy relaxed and maybe a little light headed.";
    }else if (bac <= 0.07) {
      return "Feeling of wellbeing, relaxation, sensation of warmth. Some minor impairment of reasoning. Emotions exagerated.";
    }else if (bac <= 0.1) {
      return "Slight impairment of balance, speech, vision and reaction time. Euphoria, reduced self control and judgement.";
    }else if (bac <= 0.13) {
      return "Significant impairment of motor coordination. Speech may be slurred.";
    }else if (bac <= 0.16) {
      return "Gross motor impairment. Blurred vision and major loss of balance. Euphoria is reduced. Judgement and perception severely impaired.";
    }else if (bac <= 0.2) {
      return "Dysphoria predominates. Nausea may appear.";
    }else if (bac <= 0.25) {
      return "Dazed, confused or disorientated. Nausea and vomitting. May not be able to stand or walk.";
    }else if (bac <= 0.3) {
      return "All mental and physical functions severely impaired. Increased risk of choking on vomit or accidental injury.";
    }else if (bac <= 0.35) {
      return "Stupor. Little comprehension pf where you are. You may pass out suddenly.";
    }else if (bac <= 0.4) {
      return "Coma is possible. This is the level of surgical anaethisia";
    }else {
     return "Onset of coma and possible death.";
    }
  }

})();


function addPoint(time, bac) {
   var chart = $('#chart').highcharts();
   if (chart){
     var series = chart.series[0];
     var point = [time.getTime(), bac];
     series.addPoint(point);
     chart.redraw();
   }
}
    
    
function initChart(title) {


  $(function () {
    $('#chart').highcharts({
        chart: {
            type: 'spline'
        },
        title: {
            text: title
        },
        subtitle: {
            text: ''
        },
        xAxis: {
            type: 'datetime',
            dateTimeLabelFormats: { hour: '%H:%M'},
            title: {
                text: 'Time'
            }
        },
        yAxis: {
            title: {
                text: 'BAC (mg/100mL)'
            },
            min: 0
        },
        tooltip: {
            headerFormat: '<b>{series.name}</b><br>',
            pointFormat: '{point.x:%H:%M}: {point.y} mg'
        },

        plotOptions: {
            spline: {
                marker: {
                    enabled: true
                }
            }
        },

        series: [{name: 'Blood Alcohol Content',data: []}]
    });
});

}