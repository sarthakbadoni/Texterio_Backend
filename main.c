#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main(){
  char x[20];
  fgets(x,sizeof(x),stdin);
  printf("Hello %s this is our DS project",x);
  return 0;
}