import assert from "node:assert/strict";
import { test } from "node:test";
import {
  HomologPatchError,
  homologScript,
  unescapeHtml,
} from "../../services/boardWatcher/homologReplay.js";

const group = (name: string) => `
    stage('${name}') {
      steps {
        script {
          deploy_stage = 'test'
          deploy_role = "\${ROLE_TEST}"

          if ( "\${branch_name}" ==~ /^env(.*)/) {
            deploy_stage = "\${branch_name}"
            deploy_stage = deploy_stage.toLowerCase()
          }

          if ("\${branch_name}" ==~ /^v(.*)/) {
            deploy_stage = 'prod'
          }

          sh "deploy --stage \${deploy_stage}"
        }
      }
    }`;

const jenkinsfile = `pipeline {
  stages {
    stage('Unit Test') {
      when {
        expression { return "\${branch_name}" ==~ /^env(.*)/ }
      }
      steps { sh 'make test' }
    }
    stage('Build and Deploy') {
      when {
        anyOf {
          expression { return "\${branch_name}" ==~ /^env(.*)/ }
          branch "master"
          expression { return "\${branch_name}" ==~ /^v(.*)/ }
        }
      }
      parallel {${group("Deploy group A")}${group("Deploy group B")}
      }
    }
  }
}
`;

void test("homolog: the deploy stage runs for any branch and deploys to 'test'", () => {
  const out = homologScript(jenkinsfile);
  assert.doesNotMatch(out, /branch "master"/);
  assert.doesNotMatch(out, /deploy_stage = 'prod'/);
  assert.doesNotMatch(out, /deploy_stage = "\$\{branch_name\}"/);
  assert.equal(out.match(/deploy_stage = 'test'/g)?.length, 2);
  assert.equal(out.match(/sh "deploy --stage/g)?.length, 2);
});

void test("homolog: other stages keep their conditions", () => {
  assert.match(homologScript(jenkinsfile), /stage\('Unit Test'\) \{\n\s+when \{/);
});

void test("homolog: a Jenkinsfile that changed shape is refused, not guessed", () => {
  assert.throws(() => homologScript("pipeline { stages { } }"), HomologPatchError);
  const oneGroup = jenkinsfile.replace(
    /if \("\$\{branch_name\}" ==~ \/\^v\(\.\*\)\/\) \{[^}]*\}/,
    "",
  );
  assert.throws(() => homologScript(oneGroup), HomologPatchError);
});

void test("the Replay page's script is unescaped", () => {
  assert.equal(
    unescapeHtml("a &amp;&amp; b &lt;x&gt; &quot;y&quot; &#39;z&#x27;"),
    "a && b <x> \"y\" 'z'",
  );
});
