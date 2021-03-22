require('file-loader?name=[name].[ext]!../node_modules/neo4j-driver/lib/browser/neo4j-web.min.js');

//Call of models file to stock responses from database.
var Process = require('./models/Process');
var AnalysisEntityClass = require('./models/AnalysisEntityClass')
var DLStructuredDataset = require('./models/DLStructuredDataset')
var Operation = require('./models/Operation')
var Quality = require('./models/Quality')
var QualityValue = require('./models/QualityValue')
var Study = require('./models/Study')
var Landmarker = require('./models/Landmarker')
var Parameter = require('./models/Parameter')
var ParameterSettings = require('./models/ParameterSettings')
var Evaluation = require('./models/Evaluation')
var NominalFeature = require('./models/NominalFeature')
var NumericFeature = require('./models/NumericFeature')
var NominalAttribute = require('./models/NominalAttribute')
var NumericAttribute = require('./models/NumericAttribute')
var EntityClass = require('./models/EntityClass')
var RelationshipDS = require('./models/RelationshipDS')
var AnalysisDSRelationship = require('./models/AnalysisDSRelationship')
var RelationshipAtt = require('./models/RelationshipAtt')
var Attribute = require('./models/Attribute')
var AnalysisAttribute = require('./models/AnalysisAttribute')

//Drivers and parameters to acces database 
var _ = require('lodash');
var neo4j = window.neo4j.v1;
var pwd = require("../store-password.json")
var driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", pwd.password));

//Function to search processus metadata with parameters to apply filter. 
//Attributed values are default value if no parameter is given.
function getProcesses(tags, language = "", date = "0001-01-01", typeOpe = [], exeEnv = []) {
  var session = driver.session();
  //Classic query without filter, search with name, description and tag name.
  var query = "MATCH (p:Process) OPTIONAL MATCH (p)-[r:hasTag]->(t :Tag) OPTIONAL MATCH (o:Operation)-[:isUsedBy]->(:OperationOfProcess)<-[:containsOp]-(p) WITH p,t,o WHERE ("
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.description) CONTAINS toLower('" + tags[i] + "') OR toLower(o.name) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.name) CONTAINS toLower('" + tags[i] + "') OR toLower(p.description) CONTAINS toLower('" + tags[i] + "') OR toLower(o.name) CONTAINS toLower('" + tags[i] + "') )"
    }
  }
  //Cypher query for language filter
  if (language.length > 0) {
    query += " AND ("
    for (var i = 0; i < language.length; i++) {
      if (i != language.length - 1) {
        query += " p.programmationLanguage CONTAINS ('" + language[i] + "') OR "
      } else {
        query += " p.programmationLanguage CONTAINS ('" + language[i] + "') ) "
      }
    }
  }
  //Cypher query for execution environment
  if (exeEnv.length > 0) {
    query += " AND ("
    for (var i = 0; i < exeEnv.length; i++) {
      if (i != exeEnv.length - 1) {
        query += " p.executionEnvironment CONTAINS ('" + exeEnv[i] + "') OR "
      } else {
        query += " p.executionEnvironment CONTAINS ('" + exeEnv[i] + "') ) "
      }
    }
  }
  //Cypher query for dates filter
  query = query + ' AND (date(p.creationDate) >= date("' + date + '"))'
  //Cypher query for used operation filter
  if (typeOpe.length > 0) {
    query += " AND (p)-[]-()-[]-(o:Operation) AND ("
    for (var i = 0; i < typeOpe.length; i++) {
      if (i != typeOpe.length - 1) {
        query += " o.name CONTAINS ('" + typeOpe[i] + "') OR "
      } else {
        query += " o.name CONTAINS ('" + typeOpe[i] + "') )"
      }
    }
  }
  query = query + " RETURN distinct p"
  // Query return is kept and stocked within a model with the same name to avoid confusion. Note that only one parameter of return can be stocked.
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Process(record.get('p'));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to search study metadata
function getStudies(tags, type, landmarker, algoNames, omNames) {
  var session = driver.session();
  //Classic cypher query to search for study without filter. 
  var query = "MATCH (s:Study),(a:AnalysisEntityClass),(l:Landmarker),(al) WHERE ("
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(s.name) CONTAINS toLower('" + tags[i] + "') OR toLower(s.descriptionAnalysis) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(s.name) CONTAINS toLower('" + tags[i] + "') OR toLower(s.descriptionAnalysis) CONTAINS toLower('" + tags[i] + "') )"
    }
  }
  //Cypher query for analysis type filter
  if (type.length > 0) {
    query += ' AND (s)-[:hasAnalysis]->(a) AND ('
    for (var i = 0; i < type.length; i++) {
      if (i != type.length - 1) {
        query += ' toLower(a.typeAnalysis) CONTAINS toLower("' + type[i] + '") OR '
      } else {
        query += ' toLower(a.typeAnalysis) CONTAINS toLower("' + type[i] + '") )'
      }
    }
  }
  //Cypher query for landmarkers query
  if (landmarker.length > 0) {
    query += ' AND (s)-[:hasAnalysis]->(a)-[:hasImplementation]->(l) AND ('
    for (var i = 0; i < landmarker.length; i++) {
      if (i != landmarker.length - 1) {
        query += ' toLower(l.name) CONTAINS toLower("' + landmarker[i] + '") OR toLower(l.description) CONTAINS toLower("' + landmarker[i] + '") OR '
      } else {
        query += ' toLower(l.name) CONTAINS toLower("' + landmarker[i] + '") OR toLower(l.description) CONTAINS toLower("' + landmarker[i] + '") )'
      }
    }
  }
  //Cypher query for algo filter. The database does not have all the algo type implemented so this part of query is commented.
  if (algoNames.length > 0) {
    query += ' AND (s)-[:hasAnalysis]->(a)-[:hasImplementation]->()-[:usesAlgo]->(al) AND (al:AlgoSupervised'
    // if (!type.includes("AlgoSupervised") && !type.includes("AlgoUnsupervised") && !type.includes("AlgoReinforcement")) {
    //   query += " al:AlgoSupervised OR al:AlgoUnsupervised OR al:AlgoReinforcement ";
    // } else {
    //   if (type.includes("AlgoSupervised")) {
    //     query = query + "al:AlgoSupervised";
    //     console.log('Semi : ' + query);
    //   } else {
    //     if (type.includes("AlgoUnsupervised")) {
    //       query = query + "al:AlgoUnsupervised";
    //       console.log('Unstru : ' + query);
    //     } else {
    //       if (type.includes("AlgoReinforcement")) {
    //         query = query + "al:AlgoReinforcement";
    //         console.log('Structured : ' + query);
    //       }
    //     }
    //   }
    // }

    //Cypher query to search a particular algo names.
    query += ') AND (toLower(al.name) CONTAINS toLower("' + algoNames + '") OR toLower(al.description) CONTAINS toLower("' + algoNames + '") ) '
  }
  
  //Cyper query for outpu models filter, they are not implemented in the database.
  // if(omNames>0){
  //   query += ' AND (s)-[:hasAnalysis]->(a)-[:hasOutputModel]->(opm:OutputModel) AND opm.name CONTAINS "' + omNames + '"';
  // }

  query = query + " RETURN DISTINCT s"
  
  //We get only study here, which are used later to get analysis
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Study(record.get('s'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to search for analysis metadata by study id or analysis
function getAnalyses(study, name, id) {
  var session = driver.session();
  //partie cypher de base pour récupérer les analyses
  //Classic cypher request to get analysis 
  var query = "MATCH (s:Study)-[r:hasAnalysis]->(a:AnalysisEntityClass) WHERE "
  //Cypher query if the input is Study
  if (study.length > 0) {
    for (var i = 0; i < study.length; i++) {
      if (i != study.length - 1) {
        query = query + "toLower(s.name) CONTAINS toLower('" + study[i] + "') OR "
      }
      else {
        query = query + "toLower(s.name) CONTAINS toLower('" + study[i] + "')"
      }
    }
  } else { // Cypher query if the input is an analysis
    if (name.length > 0) {
      query = query + "toLower(a.name) CONTAINS toLower('" + name + "') AND a.uuid = '" + id + "'"

    }
  }
  query = query + " RETURN DISTINCT a"
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Study(record.get('a'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get nominal features by analysis
function getNominalFeaturesbyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (nf:AnalysisNominalFeatures),(f:AnalysisFeatures),(a:AnalysisEntityClass) WHERE a.uuid = "' + analyseId + '"  AND (a)-[:hasFeaturesAnalysis]->(f)-[:hasNominalFeaturesAnalysis]->(nf) RETURN nf'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalFeature(record.get('nf'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get numeric features by analysis
function getNumericFeaturesbyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (nf:AnalysisNumericFeatures),(f:AnalysisFeatures),(a:AnalysisEntityClass) WHERE a.uuid = "' + analyseId + '"  AND (a)-[:hasFeaturesAnalysis]->(f)-[:hasNumericFeaturesAnalysis]->(nf) RETURN nf'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericFeature(record.get('nf'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get numeric attributes by analysis
function getNumericAttributebyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (na:NumericAttribute),(nf:AnalysisNumericFeatures),(f:AnalysisFeatures),(a:AnalysisEntityClass),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '"  AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNumericFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get nominal attributes by analysis
function getNominalAttributebyAnalysis(analyseId) {
  var session = driver.session();
  query = 'Match (na:NominalAttribute),(nf:AnalysisNominalFeatures),(f:AnalysisFeatures),(a:AnalysisEntityClass),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '"  AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNominalFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get a specific nominal attribute by analysis
function getNominalAttribute(name, analyseId) {
  var session = driver.session();
  query = 'Match (na:NominalAttribute),(nf:AnalysisNominalFeatures),(f:AnalysisFeatures),(a:AnalysisEntityClass),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '"  AND na.name= "' + name + '" AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNominalFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get a specific numeric attribute by analysis
function getNumericAttribute(name, analyseId) {
  var session = driver.session();
  query = 'Match (na:NumericAttribute),(nf:AnalysisNumericFeatures),(f:AnalysisFeatures),(a:AnalysisEntityClass),(ta:AnalysisTarget) WHERE a.uuid = "' + analyseId + '" AND na.name= "' + name + '"  AND ((a)-[:hasFeaturesAnalysis]->(f)-[:hasNumericFeaturesAnalysis]->(nf)-[:hasFeatures]->(na) OR (a)-[:hasTargetAnalysis]->(ta)-[:hasTarget]->(na)) RETURN DISTINCT na'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericAttribute(record.get('na'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get numeric attributes by dataset
function getNumericAttributebyDataset(datasetId) {
  var session = driver.session();
  query = 'MATCH (dl)-[]-(e:EntityClass)-[]-(a:NumericAttribute) WHERE dl.uuid = "' + datasetId + '" AND (dl:DLStructuredDataset OR dl:DLSemistructuredDataset OR dl:DLUnstructuredDataset) RETURN DISTINCT a'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NumericAttribute(record.get('a'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get nominal attributes by dataset
function getNominalAttributebyDataset(datasetId) {
  var session = driver.session();
  query = 'MATCH (dl)-[]-(e:EntityClass)-[]-(a:NominalAttribute) WHERE dl.uuid = "' + datasetId + '" AND (dl:DLStructuredDataset OR dl:DLSemistructuredDataset OR dl:DLUnstructuredDataset) RETURN DISTINCT a'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new NominalAttribute(record.get('a'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get quality informations by dataset to create filter (there are no quality in databse for now)
function getQuality(dataSet) {
  var session = driver.session();
  var query = "MATCH (q:quality),(n) WHERE (q)<-[:hasQuality]-(n) AND n.name CONTAINS (" + dataSet.name + ") RETURN DISTINCT q";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Quality(record.get('q'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}


//Function to get quaity value with dataset Id and quality name
function getQualityValue(quality, dataSet) {
  var session = driver.session();
  query = "MATCH (q:Quality)<-[r:hasQuality]-(n) WHERE q.name CONTAINS (" + quality.name + ") AND n.name CONTAINS (" + dataSet.name + ") RETURN DISTINCT r";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new QualityValue(record.get('r'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get all the operation to create filter
function getOperations() {
  var session = driver.session();
  query = "MATCH (o:Operation) RETURN DISTINCT o";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Operation(record.get('o'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get landmarkes by study to create a filter
function getLandmarkers(study) {
  var session = driver.session();
  query = "MATCH (l:Landmarker),(s:Study) WHERE (l)<-[:hasImplementation]-()<-[:hasAnalysis]-(s) AND (toLower(s.name) CONTAINS toLower('" + study.name + "')) RETURN DISTINCT l";
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Landmarker(record.get('l'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get parameter by study to create a filter
function getParameter(study) {
  var session = driver.session();
  query = 'MATCH (s:Study)-[:hasAnalysis]->()-[:hasImplementation]->()-[:hasParameter]->(p:Parameter) WHERE toLower(s.name) CONTAINS toLower("' + study.name + '") RETURN DISTINCT p'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Parameter(record.get('p'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get parameter settings
function getParameterSettings() {
  var session = driver.session();
  query += 'MATCH (p:ParameterSettings) RETURN DISTINCT p'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new ParameterSettings(record.get('p'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get evaluation by study to create a filter
function getEvaluation(study) {
  var session = driver.session();
  query = 'MATCH (s:Study)-[:hasAnalysis]->()<-[:evaluateAnalysisEntityClass]-()-[:useEvaluationMeasure]-(e:EvaluationMeasure) WHERE (toLower(s.name) CONTAINS toLower("' + study.name + '")) RETURN DISTINCT e'
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new Evaluation(record.get('e'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//Function to get entity class by analysis
function getEntityClassByAnalyse(analyseName, analyseId) {
  var session = driver.session();
  query = 'MATCH (e:EntityClass)<-[:analyze]-(a:AnalysisEntityClass) WHERE a.name = "' + analyseName + '" AND a.uuid = "' + analyseId + '" RETURN DISTINCT e';
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new EntityClass(record.get('e'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}


//function to get entity class by dataset
function getEntityClassByDataset(datasetName, datasetId, typeDS) {
  var session = driver.session();
  query = 'MATCH (e:EntityClass)<-[:hasEntityClass]-(a) WHERE '
  if (typeDS.includes("Semi-Structured")) {
    query = query + "a:DLSemistructuredDataset";
  } else {
    if (typeDS.includes("Unstructured")) {
      query = query + "a:DLUnstructuredDataset ";
    } else {
      if (typeDS.includes("Structured")) {
        query = query + "a:DLStructuredDataset ";
      }
    }
  }
  query += ' AND a.name = "' + datasetName + '" AND a.uuid = "' + datasetId + '" RETURN DISTINCT e';
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new EntityClass(record.get('e'))
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

//function to search for dataset relationship with other datasets 
function getRelationshipDSbyDataset(dsName, dsId, type, relationName='') {
  var session = driver.session();
  //Cypher request to get relationships and datasets that have relation with the target
  query = `MATCH (dl:DLSemistructuredDataset)<-[]-()-[]->(rDS:RelationshipDS),(autreDS),(adrR:AnalysisDSRelatinship)
    WHERE dl.name CONTAINS '` + dsName + `' and dl.uuid = '` + dsId + `'
    AND
    (autreDS:DLStructuredDataset OR autreDS:DLSemistructuredDataset OR autreDS:DLUnstructuredDataset)
    AND
    (autreDS)<-[]-(adrR:AnalysisDSRelatinship)-[]->(rDS:RelationshipDS)`
    if(relationName != ''){
      query += ' AND rDS.name = "'+ relationName +'"'
    }    
    query += ` RETURN DISTINCT`
  switch (type) {
    //Case to get relations
    case 'RelationshipDS':
      query += ' rDS'
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new RelationshipDS(record.get('rDS'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
    //Case to get datasets with a specific relation
    case 'Dataset':
      query += ' autreDS'
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new DLStructuredDataset(record.get('autreDS'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
  }
}

//Function to get relationship value between two datasets
function getRelationshipDSAnalysisbyDataset(dataset1, dataset2, Relationship){
  var session = driver.session();
  query = `MATCH (ds1)-[]-(adsr:AnalysisDSRelatinship)-[]-(ds2), (adsr)-[]-(rds:RelationshipDS) 
              WHERE rds.name = "` + Relationship + `" AND ds1.uuid = "` + dataset1 + `" AND ds2.uuid = "` + dataset2 + `" 
                AND (ds1:DLStructuredDataset OR ds1:DLSemistructuredDataset OR ds1:DLUnstructuredDataset) 
                AND (ds2:DLStructuredDataset OR ds2:DLSemistructuredDataset OR ds2:DLUnstructuredDataset)
                RETURN DISTINCT adsr`
  return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new AnalysisDSRelationship(record.get('adsr'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
}

//Function to search for relationships between attribute by datasets or analysis. allow to get relationship name,value and others attributes linked to the target.
function getRelationshipAttribute(sourceId,name='', type, relationName='', name2='') {
  var session = driver.session();
  query = `MATCH (dl)-[]-(e:EntityClass)-[]-(a),(a)-[r1:hasAttribute]-(AA:AnalysisAttribute)-[r2:useMeasure]-(RA:RelationshipAtt),(AA)-[r3:hasAttribute]-(a2)
  WHERE dl.uuid = '`+sourceId+`'
  AND
  (a:NominalAttribute OR a:NumericAttribute OR a:Attribute)`
  if(relationName != ''){
    query += ' AND RA.name ="' + relationName + '"'
  }
  
  switch (type) {
    case 'relation' :
      query += ` RETURN DISTINCT RA`
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new RelationshipAtt(record.get('RA'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
    case 'analyse':
      query += `RETURN DISTINCT a`
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new Attribute(record.get('a'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });
    case 'relationValue':
      query += ` AND toLower(a2.name) CONTAINS toLower('`+ name2 +`') AND toLower(a.name) CONTAINS toLower('` +name+ `') RETURN DISTINCT AA`
      return session
        .run(
          query)
        .then(result => {
          return result.records.map(record => {
            return new AnalysisAttribute(record.get('AA'))
          });
        })
        .catch(error => {
          throw error;
        })
        .finally(() => {
          return session.close();
        });

  }
  
}

//fonction de recherches des datasets avec les différents paramètres pour chaque filtre.
//Function to search dataset metadata, with parameters for each filter.
function getDatabases(tags, type = 'defaultValue', creationdate = '0001-01-01', quality = [], sensitivity = 0, entityAttributeNames = "") {
  var session = driver.session();
  console.log('début session recherche bdd');
  console.log('tags : ' + tags);
  console.log('type :' + type);
  console.log('date :' + creationdate);
  console.log('quality :' + quality);
  console.log('sensitivity :' + sensitivity);
  console.log("EntityAttributenames :" + entityAttributeNames);
  /* MATCH
    (n),(a),(e:EntityClass),(q:QualityMetric),(s:SensitivityMark), (sv:SensitivityValue)
WHERE
  (n:DLStructuredDataset OR n:DLSemistructuredDataset OR n:DLUnstructuredDataset)
    AND
      (toLower(n.name) CONTAINS toLower('mimic')
      OR toLower(n.description) CONTAINS toLower('mimic'))
    AND
      (a:Attribute OR a:NominalAttribute OR a:NumericAttribute)
    AND
      ((n)-[:hasEntityClass]->(e)-[:hasAttribute]->(a))
    AND
      (toLower(e.name) CONTAINS toLower('chart') OR
      toLower(a.name) CONTAINS toLower('chart'))
    AND
  (n)-[qv:qualityValue]-(q)  
      AND
(toLower(q.name) CONTAINS toLower(‘something’) AND qv.value >= ‘inputValue’ )
      AND
  (n)-[:hasSensitivity]-(s)-[:hasValue]-(sv)  
      AND
(toLower(s.name) CONTAINS toLower(‘something’) AND sv.value >= ‘inputValue’ )  
RETURN n
UNION
MATCH
    (n)-[:hasTag]->(t:Tag)
WHERE
  (n:DLStructuredDataset OR n:DLSemistructuredDataset OR n:DLUnstructuredDataset)
    AND
    toLower(t.name) = toLower('mimic')
RETURN n
 */

//Cypher query with ifs to have the dataset type filter used.
  var query = "MATCH (ds),(a),(e:EntityClass) WHERE ("; //,(q:QualityMetric),(s:SensitivityMark), (sv:SensitivityValue)
  if (!type.includes("Structured") && !type.includes("Semi-Structured") && !type.includes("Unstructured")) {
    query += " ds:DLStructuredDataset OR ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset ";
  } else {
    if (type.includes("Structured") && type.includes("Semi-Structured") && type.includes("Unstructured")) {
      query += " ds:DLStructuredDataset OR ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset ";
    } else {
      if (type.includes("Structured") && type.includes("Semi-Structured")) {
        query += " ds:DLStructuredDataset OR ds:DLSemistructuredDataset ";
      } else {
        if (type.includes("Structured") && type.includes("Unstructured")) {
          query += " ds:DLStructuredDataset OR ds:DLUnstructuredDataset ";
        } else {
          if (type.includes("Semi-Structured") && type.includes("Unstructured")) {
            query += " ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset ";
          } else {
            if (type.includes("Semi-Structured")) {
              query = query + "ds:DLSemistructuredDataset";
              console.log('Semi : ' + query);
            } else {
              if (type.includes("Unstructured")) {
                query = query + "ds:DLUnstructuredDataset ";
                console.log('Unstru : ' + query);
              } else {
                if (type.includes("Structured")) {
                  query = query + "ds:DLStructuredDataset";
                  console.log('Structured : ' + query);
                }
              }
            }
          }
        }
      }
    }
  }
  query = query + ") AND (";
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(ds.name) CONTAINS toLower('" + tags[i] + "') OR toLower(ds.description) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(ds.name) CONTAINS toLower('" + tags[i] + "') OR toLower(ds.description) CONTAINS toLower('" + tags[i] + "')"
    }
  }

  //Cypher query for dates filter
  query = query + ') AND (date(ds.creationDate) >= date("' + creationdate + '"))'

  //Cypher query for the quality filter
  // if(quality.lenght>0){
  //   query += "AND (n)-[qv:qualityValue]-(q) AND ("
  //   for( var i=0; i<quality.length; i++){
  //     if(i!=quality.length -1){
  //       query += "toLower(q.name) CONTAINS toLower("+ quality[i][0] +") AND qv.value >= "+ quality[i][1] +" OR" ;
  //     }else{
  //       query += "toLower(q.name) CONTAINS toLower("+ quality[i][0] +") AND qv.value >= "+ quality[i][1] +" )  "
  //     }
  //   }
  // }

  //Cyper query for the sensitivity filter
  // if(sensitivity != 0){
  //   query += "(n)-[:hasSensitivity]-(s)-[:hasValue]-(sv) AND (sv.value >= "+ sensitivity +" )";
  // }

  //Cypher query for the entity class filter
  if (entityAttributeNames.length > 0) {
    query += "AND (a:Attribute OR a:NominalAttribute OR a:NumericAttribute) AND ((ds)-[:hasEntityClass]->(e)-[:hasAttribute]->(a)) AND ("
    for (var i = 0; i < entityAttributeNames.length; i++) {
      if (i != entityAttributeNames.length - 1) {
        query += "toLower(e.name) CONTAINS toLower('" + entityAttributeNames[i] + "') OR toLower(a.name) CONTAINS toLower('" + entityAttributeNames[i] + "') OR "
      } else {
        query += "toLower(e.name) CONTAINS toLower('" + entityAttributeNames[i] + "') OR toLower(a.name) CONTAINS toLower('" + entityAttributeNames[i] + "'))"
      }
    }
  }

  //Cypher query that allow a dataset to not have a Tag, else it is not taken in account
  query = query + ' RETURN ds UNION MATCH (ds)-[:hasTag]->(t:Tag) WHERE (ds:DLStructuredDataset OR ds:DLSemistructuredDataset OR ds:DLUnstructuredDataset) AND ('
  for (var i = 0; i < tags.length; i++) {
    if (i != tags.length - 1) {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "') OR "
    }
    else {
      query = query + "toLower(t.name) CONTAINS toLower('" + tags[i] + "')"
    }
  }

  query = query + ") RETURN distinct ds"
  console.log('requete : ' + query)
  return session
    .run(
      query)
    .then(result => {
      return result.records.map(record => {
        return new DLStructuredDataset(record.get('ds'));
      });
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}


//Exports of used functions
exports.getProcesses = getProcesses;
exports.getStudies = getStudies;
exports.getAnalyses = getAnalyses;
exports.getDatabases = getDatabases;
exports.getQuality = getQuality;
exports.getQualityValue = getQualityValue;
exports.getOperations = getOperations;
exports.getLandmarkers = getLandmarkers;
exports.getParameter = getParameter;
exports.getParameterSettings = getParameterSettings;
exports.getEvaluation = getEvaluation;
exports.getNominalFeaturesbyAnalysis = getNominalFeaturesbyAnalysis;
exports.getNumericFeaturesbyAnalysis = getNumericFeaturesbyAnalysis;
exports.getNumericAttributebyAnalysis = getNumericAttributebyAnalysis;
exports.getNominalAttributebyAnalysis = getNominalAttributebyAnalysis;
exports.getNominalAttribute = getNominalAttribute;
exports.getNumericAttribute = getNumericAttribute;
exports.getEntityClassByAnalyse = getEntityClassByAnalyse;
exports.getEntityClassByDataset = getEntityClassByDataset;
exports.getRelationshipDSbyDataset = getRelationshipDSbyDataset;
exports.getRelationshipDSAnalysisbyDataset = getRelationshipDSAnalysisbyDataset;
exports.getNumericAttributebyDataset = getNumericAttributebyDataset;
exports.getNominalAttributebyDataset = getNominalAttributebyDataset;
exports.getRelationshipAttribute = getRelationshipAttribute;



/*

function getGraph() {
  var session = driver.session();
  return session.run(
    'MATCH (m:Movie)<-[:ACTED_IN]-(a:Person) \
    RETURN m.title AS movie, collect(a.name) AS cast \
    LIMIT $limit', {limit: neo4j.int(100)})
    .then(results => {
      var nodes = [], rels = [], i = 0;
      results.records.forEach(res => {
        nodes.push({title: res.get('movie'), label: 'movie'});
        var target = i;
        i++;

        res.get('cast').forEach(name => {
          var actor = {title: name, label: 'actor'};
          var source = _.findIndex(nodes, actor);
          if (source === -1) {
            nodes.push(actor);
            source = i;
            i++;
          }
          rels.push({source, target})
        })
      });

      return {nodes, links: rels};
    })
    .catch(error => {
      throw error;
    })
    .finally(() => {
      return session.close();
    });
}

exports.searchMovies = searchMovies;
exports.getMovie = getMovie;
exports.getGraph = getGraph;*/